import redis, { RedisClient } from 'redis';
import config from '../config';
import logger from '../logger';
import { Game } from '../types';

export interface GameDb {
  getGame(code: number): Promise<Game | null>;
  setGame(game: Game): Promise<Game>;
  exists(code: number): Promise<boolean>;
}

export class InMemoryGameDb implements GameDb {
  private games: { [code: number]: Game };

  constructor() {
    logger.info({ message: 'Initializing InMemoryGameDb...' });
    this.games = {};
  }

  getGame(code: number) {
    const game = this.games[code];

    return Promise.resolve(game ? game : null);
  }

  setGame(game: Game) {
    const g = { ...game, revision: game.revision + 1 };
    this.games[game.code] = g;

    return Promise.resolve(g);
  }

  exists(code: number) {
    const exists = code in this.games;

    return Promise.resolve(exists);
  }
}

export class RedisGameDb implements GameDb {
  private client: RedisClient;
  private prefix = 'gmaa-game';
  private gameTtlSec = 30 * 60;

  constructor() {
    logger.info({ message: 'Initilizing RedisGameDb...' });
    this.client = redis.createClient(config.REDIS_URL);
  }

  getGame(code: number): Promise<Game | null> {
    return new Promise((resolve, reject) => {
      this.client.get(`${this.prefix}:${code}`, (err, result) => {
        if (err) {
          return reject(err);
        }

        if (!result) {
          return resolve(null);
        }

        resolve(JSON.parse(result) as Game);
      });
    });
  }

  setGame(game: Game): Promise<Game> {
    return new Promise((resolve, reject) => {
      const g = { ...game, revision: game.revision + 1 };
      this.client.set(`${this.prefix}:${game.code}`, JSON.stringify(g), 'EX', this.gameTtlSec, (err, _result) => {
        if (err) {
          return reject(err);
        }

        resolve(g);
      });
    });
  }

  exists(code: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.exists(`${this.prefix}:${code}`, (err, result) => {
        if (err) {
          return reject(err);
        }

        resolve(result === 1);
      });
    });
  }
}
