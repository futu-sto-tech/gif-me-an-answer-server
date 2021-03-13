import { Game, GameRound, GameRoundStatus, GameStatus, Image, Player, PlayerStatus } from '../types';

import { v4 as uuidv4 } from 'uuid';
import { isErr, Result as R } from '../utils';
import { GameDb } from './db';

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

export class GameService {
  private GAMES: { [code: number]: Game };
  private db: GameDb;

  constructor(db: GameDb) {
    this.GAMES = {};
    this.db = db;
  }

  getGame(code: number): Result<Game, 'no-such-game'> {
    const game = this.GAMES[code];

    return game ? game : { error: 'no-such-game' };
  }

  addGame(game: Game): Result<void, 'game-exists'> {
    if (game.code in this.GAMES) {
      return { error: 'game-exists' };
    }

    this.GAMES[game.code] = game;
  }

  addPlayer(code: number, name: string): Result<Player, 'no-such-game' | 'player-exists'> {
    const maybeGame = this.getGame(code);

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
    this.GAMES[code] = { ...maybeGame, players };

    return player;
  }

  playerReady(code: number, playerId: string): Result<void, 'no-such-game' | 'no-such-player'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const player = maybeGame.players.find((p) => p.id === playerId);

    if (!player) {
      return { error: 'no-such-player' };
    }

    player.status = PlayerStatus.READY;
  }

  allPlayersInState(code: number, state: PlayerStatus): Result<boolean, 'no-such-game'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    return maybeGame.players.every((p) => p.status === state);
  }

  allPlayersReady(code: number): Result<boolean, 'no-such-game'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    if (maybeGame.totalPlayers !== maybeGame.players.length) {
      return false;
    }

    return this.allPlayersInState(code, PlayerStatus.READY);
  }

  selectImage(
    code: number,
    playerId: string,
    imageUrl: string
  ): Result<void, 'no-such-game' | 'no-such-round' | 'no-such-player'> {
    const maybeGame = this.getGame(code);

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

  startNewRound(code: number): Result<void, 'no-such-game' | 'in-active-round' | 'no-remaining-rounds'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }
    if (!maybeGame.rounds.some((r) => r.status === GameRoundStatus.NOT_STARTED)) {
      return { error: 'no-remaining-rounds' };
    }
    if (maybeGame.rounds.some((r) => ![GameRoundStatus.NOT_STARTED, GameRoundStatus.FINSIHED].includes(r.status))) {
      return { error: 'in-active-round' };
    }

    this.startImageSelection(code);
  }

  private changeGameRoundStatus(
    code: number,
    from: GameRoundStatus,
    to: GameRoundStatus
  ): Result<void, 'no-such-game' | 'bad-round-state'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.status === from);

    if (!round) {
      return { error: 'bad-round-state' };
    }

    round.status = to;
  }

  startImageSelection(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.NOT_STARTED, GameRoundStatus.SELECT_GIF);
  }

  startVote(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.PRESENT, GameRoundStatus.VOTE);
  }

  startPresentation(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.SELECT_GIF, GameRoundStatus.PRESENT);
  }

  finishRound(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.VOTE, GameRoundStatus.FINSIHED);
  }

  vote(
    code: number,
    playerId: string,
    imageId: string
  ): Result<
    void,
    'no-such-game' | 'bad-round-state' | 'no-such-image' | 'no-such-player' | 'own-image' | 'already-voted'
  > {
    const maybeGame = this.getGame(code);

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

  assignPoints(code: number): Result<void, 'no-such-game' | 'bad-round-state'> {
    const maybeGame = this.getGame(code);

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

  setPresentedImage(code: number, image: Image): Result<void, 'no-such-game' | 'bad-round-state'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.status === GameRoundStatus.PRESENT);

    if (!round) {
      return { error: 'bad-round-state' };
    }

    round.presentImage = image.url;
  }

  finishGame(code: number): Result<void, 'no-such-game'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    maybeGame.status = GameStatus.FINISHED;
  }

  nextRound(code: number): Result<void, 'no-such-game' | 'no-such-round'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    if (maybeGame.currentRound >= maybeGame.totalRounds) {
      return { error: 'no-such-round' };
    }

    maybeGame.currentRound += 1;
  }

  getRound(code: number, roundNumber: number): Result<GameRound, 'no-such-game' | 'no-such-round'> {
    const maybeGame = this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.order === roundNumber);

    if (!round) {
      return { error: 'no-such-round' };
    }

    return round;
  }

  deselectImage(
    code: number,
    roundNumber: number,
    playerId: string,
    imageUrl: string
  ): Result<void, 'no-such-game' | 'no-such-round' | 'no-such-image' | 'bad-round-state'> {
    const round = this.getRound(code, roundNumber);

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
}
