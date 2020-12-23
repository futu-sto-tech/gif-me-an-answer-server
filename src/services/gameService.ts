import { v4 as uuidv4 } from 'uuid';
import { Game, GameRoundStatus, Player, PlayerStatus } from '../types';

interface GameService {
  [code: number]: Game;
}

const GAMES: GameService = {};

export function getGame(code: number) {
  return GAMES[code];
}

export function addGame(game: Game) {
  if (game.code in GAMES) {
    throw Error('Game with same code already exists!');
  }

  GAMES[game.code] = game;
}

export function addPlayer(code: number, name: string): Player {
  const game = getGame(code);

  if (game.players.some((p) => p.name === name)) {
    throw Error('Player with this name already exists!');
  }

  const player: Player = {
    id: uuidv4(),
    name,
    status: PlayerStatus.JOINED,
    points: 0,
  };

  const players = [...game.players, player];
  GAMES[code] = { ...game, players };

  return player;
}

export function playerReady(code: number, playerId: string) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  const player = game.players.find((p) => p.id === playerId);

  if (!player) {
    throw Error(`Player ${playerId} not found!`);
  }

  player.status = PlayerStatus.READY;
}

export function allPlayersReady(code: number) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  return game.players.every((p) => p.status === PlayerStatus.READY);
}

export function selectImage(code: number, playerId: string, imageUrl: string) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  if (!game.players.some((p) => p.id === playerId)) {
    throw Error(`Player ${playerId} not found!`);
  }

  const round = game.rounds.find((r) => r.status === GameRoundStatus.SELECT_GIF);

  if (!round) {
    throw Error('Did not find a matching round');
  }

  round.images = round.images
    .filter((i) => i.playerId !== playerId) // replace any image previously selected by the player
    .concat({
      id: Buffer.from(imageUrl).toString('base64'),
      url: imageUrl,
      playerId,
      votes: 0,
    });
}

export function startNewRound(code: number) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  if (game.rounds.some((r) => r.status === GameRoundStatus.SELECT_GIF)) {
    return;
  }

  const nextRound = game.rounds.find((r) => r.status === GameRoundStatus.NOT_STARTED);

  if (!nextRound) {
    throw Error('No next round');
  }

  nextRound.status = GameRoundStatus.SELECT_GIF;
}
