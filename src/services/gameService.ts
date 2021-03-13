import { Game, GameRound, GameRoundStatus, GameStatus, Image, Player, PlayerStatus } from '../types';

import { v4 as uuidv4 } from 'uuid';
import { isErr, Result as R } from '../utils';

type GameServiceErrors =
  | 'no-such-game'
  | 'no-such-player'
  | 'no-such-round'
  | 'no-such-image'
  | 'game-exists'
  | 'player-exists'
  | 'in-active-round'
  | 'no-remaining-rounds'
  | 'bad-round-state'
  | 'own-image'
  | 'already-voted';

type Result<T, E extends GameServiceErrors> = R<T, E>;

interface GameService {
  [code: number]: Game;
}

const GAMES: GameService = {};

export function getGame(code: number): Result<Game, 'no-such-game'> {
  const game = GAMES[code];

  return game ? game : { error: 'no-such-game' };
}

export function addGame(game: Game): Result<void, 'game-exists'> {
  if (game.code in GAMES) {
    return { error: 'game-exists' };
  }

  GAMES[game.code] = game;
}

export function addPlayer(code: number, name: string): Result<Player, 'no-such-game' | 'player-exists'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  if (maybeGame.players.some((p) => p.name === name)) {
    return { error: 'player-exists' };
  }

  const player: Player = {
    id: uuidv4(),
    name,
    status: PlayerStatus.JOINED,
    points: 0,
  };

  const players = [...maybeGame.players, player];
  GAMES[code] = { ...maybeGame, players };

  return player;
}

export function playerReady(code: number, playerId: string): Result<void, 'no-such-game' | 'no-such-player'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const player = maybeGame.players.find((p) => p.id === playerId);

  if (!player) {
    return { error: 'no-such-player' };
  }

  player.status = PlayerStatus.READY;
}

export function allPlayersInState(code: number, state: PlayerStatus): Result<boolean, 'no-such-game'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  return maybeGame.players.every((p) => p.status === state);
}

export function allPlayersReady(code: number): Result<boolean, 'no-such-game'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  if (maybeGame.totalPlayers !== maybeGame.players.length) {
    return false;
  }

  return allPlayersInState(code, PlayerStatus.READY);
}

export function selectImage(
  code: number,
  playerId: string,
  imageUrl: string
): Result<void, 'no-such-game' | 'no-such-round' | 'no-such-player'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const player = maybeGame.players.find((p) => p.id === playerId);
  if (!player) {
    return { error: 'no-such-player' };
  }
  player.status = PlayerStatus.SELECTED_GIF;

  const round = maybeGame.rounds.find((r) => r.status === GameRoundStatus.SELECT_GIF);

  if (!round) {
    return { error: 'no-such-round' };
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

export function startNewRound(code: number): Result<void, 'no-such-game' | 'in-active-round' | 'no-remaining-rounds'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }
  if (!maybeGame.rounds.some((r) => r.status === GameRoundStatus.NOT_STARTED)) {
    return { error: 'no-remaining-rounds' };
  }
  if (maybeGame.rounds.some((r) => ![GameRoundStatus.NOT_STARTED, GameRoundStatus.FINSIHED].includes(r.status))) {
    return { error: 'in-active-round' };
  }

  startImageSelection(code);
}

function changeGameRoundStatus(
  code: number,
  from: GameRoundStatus,
  to: GameRoundStatus
): Result<void, 'no-such-game' | 'bad-round-state'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const round = maybeGame.rounds.find((r) => r.status === from);

  if (!round) {
    return { error: 'bad-round-state' };
  }

  round.status = to;
}

export function startImageSelection(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.NOT_STARTED, GameRoundStatus.SELECT_GIF);
}

export function startVote(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.PRESENT, GameRoundStatus.VOTE);
}

export function startPresentation(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.SELECT_GIF, GameRoundStatus.PRESENT);
}

export function finishRound(code: number) {
  return changeGameRoundStatus(code, GameRoundStatus.VOTE, GameRoundStatus.FINSIHED);
}

export function vote(
  code: number,
  playerId: string,
  imageId: string
): Result<
  void,
  'no-such-game' | 'bad-round-state' | 'no-such-image' | 'no-such-player' | 'own-image' | 'already-voted'
> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const round = maybeGame.rounds.find((r) => r.status === GameRoundStatus.VOTE);

  if (!round) {
    return { error: 'bad-round-state' };
  }

  const image = round.images.find((img) => img.id === imageId);
  const player = maybeGame.players.find((p) => p.id === playerId);

  if (!image) {
    return { error: 'no-such-image' };
  }
  if (!player) {
    return { error: 'no-such-player' };
  }
  if (player.status === PlayerStatus.VOTED) {
    return { error: 'already-voted' };
  }
  if (image.playerId === playerId) {
    return { error: 'own-image' };
  }

  image.votes += 1;
  player.status = PlayerStatus.VOTED;
}

export function assignPoints(code: number): Result<void, 'no-such-game' | 'bad-round-state'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const round = maybeGame.rounds.find((item) => item.status === GameRoundStatus.VOTE);

  if (!round) {
    return { error: 'bad-round-state' };
  }

  for (const image of round.images) {
    const player = maybeGame.players.find((item) => item.id === image.playerId);
    if (player) {
      player.points += image.votes;
    }
  }
}

export function setPresentedImage(code: number, image: Image): Result<void, 'no-such-game' | 'bad-round-state'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const round = maybeGame.rounds.find((r) => r.status === GameRoundStatus.PRESENT);

  if (!round) {
    return { error: 'bad-round-state' };
  }

  round.presentImage = image.url;
}

export function finishGame(code: number): Result<void, 'no-such-game'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  maybeGame.status = GameStatus.FINISHED;
}

export function nextRound(code: number): Result<void, 'no-such-game' | 'no-such-round'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  if (maybeGame.currentRound >= maybeGame.totalRounds) {
    return { error: 'no-such-round' };
  }

  maybeGame.currentRound += 1;
}

export function getRound(code: number, roundNumber: number): Result<GameRound, 'no-such-game' | 'no-such-round'> {
  const maybeGame = getGame(code);

  if (isErr(maybeGame)) {
    return maybeGame;
  }

  const round = maybeGame.rounds.find((r) => r.order === roundNumber);

  if (!round) {
    return { error: 'no-such-round' };
  }

  return round;
}

export function deselectImage(
  code: number,
  roundNumber: number,
  playerId: string,
  imageUrl: string
): Result<void, 'no-such-game' | 'no-such-round' | 'no-such-image' | 'bad-round-state'> {
  const round = getRound(code, roundNumber);

  if (isErr(round)) {
    return round;
  }

  if (round.status !== GameRoundStatus.SELECT_GIF) {
    return { error: 'bad-round-state' };
  }

  const image = round.images.find((item) => item.playerId === playerId);

  if (!image || image.url !== imageUrl) {
    return { error: 'no-such-image' };
  }

  round.images = round.images.filter(({ id }) => id !== image.id);
}
