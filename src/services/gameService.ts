import { Game, GameRound, GameRoundStatus, GameStatus, Image, Player, PlayerStatus } from '../types';

import { v4 as uuidv4 } from 'uuid';
import { isErr, Result as R } from '../utils';
import { GameDb } from './db';

export type GameServiceErrors =
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
  private db: GameDb;

  constructor(db: GameDb) {
    this.db = db;
  }

  async getGame(code: number): Promise<Result<Game, 'no-such-game'>> {
    const game = await this.db.getGame(code);

    return game ? game : { error: 'no-such-game' };
  }

  async addGame(game: Game): Promise<Result<Game, 'game-exists'>> {
    if (await this.db.exists(game.code)) {
      return { error: 'game-exists' };
    }

    return this.db.setGame(game);
  }

  async addPlayer(
    code: number,
    name: string,
    isHost: boolean
  ): Promise<Result<Player, 'no-such-game' | 'player-exists'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    if (maybeGame.players.some((p) => p.name === name)) {
      return { error: 'player-exists' };
    }

    const player: Player = {
      id: uuidv4(),
      name,
      isHost,
      status: PlayerStatus.JOINED,
      points: 0,
    };

    const players = [...maybeGame.players, player];

    this.db.setGame({ ...maybeGame, players });

    return player;
  }

  async changePlayerCount(code: number, newCount: number): Promise<Result<Game, 'no-such-game'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const updatedGame = { ...maybeGame, totalPlayers: newCount };

    return this.db.setGame(updatedGame);
  }

  async playerReady(code: number, playerId: string): Promise<Result<Game, 'no-such-game' | 'no-such-player'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const player = maybeGame.players.find((p) => p.id === playerId);

    if (!player) {
      return { error: 'no-such-player' };
    }

    player.status = PlayerStatus.READY;

    return this.db.setGame(maybeGame);
  }

  async allPlayersInState(code: number, state: PlayerStatus): Promise<Result<boolean, 'no-such-game'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    return maybeGame.players.every((p) => p.status === state);
  }

  async allPlayersReady(code: number): Promise<Result<boolean, 'no-such-game'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    if (maybeGame.totalPlayers !== maybeGame.players.length) {
      return false;
    }

    return this.allPlayersInState(code, PlayerStatus.READY);
  }

  async selectImage(
    code: number,
    playerId: string,
    imageUrl: string
  ): Promise<Result<Game, 'no-such-game' | 'no-such-round' | 'no-such-player'>> {
    const maybeGame = await this.getGame(code);

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
        votedBy: [],
        votes: 0,
      });

    return this.db.setGame(maybeGame);
  }

  async startNewRound(
    code: number
  ): Promise<Result<Game, 'no-such-game' | 'in-active-round' | 'no-remaining-rounds' | 'bad-round-state'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }
    if (!maybeGame.rounds.some((r) => r.status === GameRoundStatus.NOT_STARTED)) {
      return { error: 'no-remaining-rounds' };
    }
    if (maybeGame.rounds.some((r) => ![GameRoundStatus.NOT_STARTED, GameRoundStatus.FINSIHED].includes(r.status))) {
      return { error: 'in-active-round' };
    }

    return this.startImageSelection(code);
  }

  private async changeGameRoundStatus(
    code: number,
    from: GameRoundStatus,
    to: GameRoundStatus
  ): Promise<Result<Game, 'no-such-game' | 'bad-round-state'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.status === from);

    if (!round) {
      return { error: 'bad-round-state' };
    }

    round.status = to;

    return this.db.setGame(maybeGame);
  }

  async startImageSelection(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.NOT_STARTED, GameRoundStatus.SELECT_GIF);
  }

  async startVote(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.PRESENT, GameRoundStatus.VOTE);
  }

  async startPresentation(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.SELECT_GIF, GameRoundStatus.PRESENT);
  }

  async finishRound(code: number) {
    return this.changeGameRoundStatus(code, GameRoundStatus.VOTE, GameRoundStatus.FINSIHED);
  }

  async vote(
    code: number,
    playerId: string,
    imageId: string
  ): Promise<
    Result<
      Game,
      'no-such-game' | 'bad-round-state' | 'no-such-image' | 'no-such-player' | 'own-image' | 'already-voted'
    >
  > {
    const maybeGame = await this.getGame(code);

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
    image.votedBy = [...image.votedBy, playerId];
    player.status = PlayerStatus.VOTED;

    return this.db.setGame(maybeGame);
  }

  async assignPoints(code: number): Promise<Result<Game, 'no-such-game' | 'bad-round-state'>> {
    const maybeGame = await this.getGame(code);

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

    return this.db.setGame(maybeGame);
  }

  async setPresentedImage(code: number, image: Image): Promise<Result<Game, 'no-such-game' | 'bad-round-state'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.status === GameRoundStatus.PRESENT);

    if (!round) {
      return { error: 'bad-round-state' };
    }

    round.presentImage = image.url;

    return this.db.setGame(maybeGame);
  }

  async finishGame(code: number): Promise<Result<Game, 'no-such-game'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    maybeGame.status = GameStatus.FINISHED;

    return this.db.setGame(maybeGame);
  }

  async nextRound(code: number): Promise<Result<Game, 'no-such-game' | 'no-such-round'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    if (maybeGame.currentRound >= maybeGame.totalRounds) {
      return { error: 'no-such-round' };
    }

    maybeGame.currentRound += 1;

    return this.db.setGame(maybeGame);
  }

  async deselectImage(
    code: number,
    roundNumber: number,
    playerId: string,
    imageUrl: string
  ): Promise<Result<Game, 'no-such-game' | 'no-such-round' | 'no-such-image' | 'bad-round-state'>> {
    const maybeGame = await this.getGame(code);

    if (isErr(maybeGame)) {
      return maybeGame;
    }

    const round = maybeGame.rounds.find((r) => r.order === roundNumber);

    if (!round) {
      return { error: 'no-such-round' };
    }

    if (round.status !== GameRoundStatus.SELECT_GIF) {
      return { error: 'bad-round-state' };
    }

    const image = round.images.find((item) => item.playerId === playerId);

    if (!image || image.url !== imageUrl) {
      return { error: 'no-such-image' };
    }

    round.images = round.images.filter(({ id }) => id !== image.id);

    return this.db.setGame(maybeGame);
  }
}
