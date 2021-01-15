import { Game, GameRoundStatus, Player, PlayerStatus } from '../types';

import { v4 as uuidv4 } from 'uuid';

interface GameService {
  [code: number]: Game;
}

const GAMES: GameService = {};

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

function getGame(code: number) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  return game;
}

export function allPlayersInState(code: number, state: PlayerStatus) {
  const game = getGame(code);
  return game.players.every((p) => p.status === state);
}

export function allPlayersReady(code: number) {
  const game = getGame(code);

  if (game.totalPlayers !== game.players.length) {
    return false;
  }

  return allPlayersInState(code, PlayerStatus.READY);
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

  const noRemainingRounds = !game.rounds.some((r) => r.status === GameRoundStatus.NOT_STARTED);
  const inActiveRound = game.rounds.some(
    (r) => ![GameRoundStatus.NOT_STARTED, GameRoundStatus.FINSIHED].includes(r.status)
  );

  if (noRemainingRounds || inActiveRound) {
    return;
  }

  startImageSelection(code);
}

function changeGameRoundStatus(code: number, from: GameRoundStatus, to: GameRoundStatus) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  const round = game.rounds.find((r) => r.status === from);

  if (!round) {
    throw Error(`Game ${code} is not currently in state ${from}`);
  }

  round.status = to;
}

export function startImageSelection(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.NOT_STARTED, GameRoundStatus.SELECT_GIF);
}

export function startVote(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.SELECT_GIF, GameRoundStatus.VOTE);
}

export function startPresentation(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.VOTE, GameRoundStatus.PRESENT);
}

export function vote(code: number, playerId: string, imageId: string) {
  const game = GAMES[code];

  if (!game) {
    throw Error(`Game ${code} does not exist!`);
  }

  const round = game.rounds.find((r) => r.status === GameRoundStatus.VOTE);

  if (!round) {
    throw Error(`Game ${code} is not currently in a voting state`);
  }

  const image = round.images.find((img) => img.id === imageId);
  const player = game.players.find((p) => p.id === playerId);

  if (!image) {
    throw Error(`No image with id ${imageId}`);
  }
  if (!player) {
    throw Error(`No player with id ${playerId}`);
  }
  if (player.status === PlayerStatus.VOTED) {
    throw Error(`Player ${playerId} already voted`);
  }
  if (image.playerId === playerId) {
    throw Error(`Not allowed to vote on your own image`);
  }

  image.votes += 1;
  player.status = PlayerStatus.VOTED;
}
