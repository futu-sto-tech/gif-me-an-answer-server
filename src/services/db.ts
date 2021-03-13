import redis, { RedisClient } from 'redis';
import config from '../config';
import { Game } from '../types';

export class GameDb {
  private client: RedisClient;
  private prefix = 'gmaa-game';
  private gameTtlSec = 30 * 60;

  constructor() {
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

  setGame(game: Game): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.set(`${this.prefix}:${game.code}`, JSON.stringify(game), 'EX', this.gameTtlSec, (err, _result) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  }
}
