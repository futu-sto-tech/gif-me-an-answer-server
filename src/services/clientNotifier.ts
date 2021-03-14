import { EventEmitter } from 'events';
import { Response } from 'express';
import { createClient, RedisClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../logger';
import { Events } from '../types';

interface Client {
  id: string;
  gameCode: number;
  res: Response;
}

interface PubSub {
  onMessage: (cb: (gameCode: number, eventName: Events, data: any) => void) => void;
  publishMessage: (gameCode: number, eventName: Events, data: any) => void;
}

class EventPubSub implements PubSub {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  onMessage = (cb: (gameCode: number, eventName: Events, data: any) => void) => {
    this.emitter.on('message', cb);
  };

  publishMessage = (gameCode: number, eventName: Events, data: any) => {
    this.emitter.emit('message', gameCode, eventName, data);
  };
}

class RedisPubSub implements PubSub {
  private channel = 'gmaa-game-events';
  private subscriber: RedisClient;
  private publisher: RedisClient;

  constructor(url: string) {
    this.publisher = createClient(url);
    this.subscriber = createClient(url);
    this.subscriber.subscribe(this.channel);
  }

  onMessage = (cb: (gameCode: number, eventName: Events, data: any) => void) => {
    this.subscriber.on('message', (_channel, message) => {
      const { gameCode, eventName, data } = JSON.parse(message) as { gameCode: number; eventName: Events; data: any };

      cb(gameCode, eventName, data);
    });
  };

  publishMessage = (gameCode: number, eventName: Events, data: any) => {
    this.publisher.publish(this.channel, JSON.stringify({ gameCode, eventName, data }));
  };
}

export class ClientNotifier {
  private clients: Client[];
  private subscriber: PubSub;
  private publisher: PubSub;

  constructor() {
    this.clients = [];

    if (config.REDIS_URL) {
      logger.info({ message: 'Initializing ClientNotifier with RedisPubSub' });

      this.subscriber = new RedisPubSub(config.REDIS_URL);
      this.publisher = new RedisPubSub(config.REDIS_URL);
    } else {
      logger.info({ message: 'Initializing ClientNotifier with EventPubSub' });

      const pubSub = new EventPubSub();
      this.subscriber = pubSub;
      this.publisher = pubSub;
    }

    this.subscriber.onMessage((gameCode, eventName, data) => {
      const players = this.clients.filter((c) => c.gameCode === gameCode);

      const payload = {
        event: eventName,
        data,
      };

      players.forEach((p) => {
        p.res.write(`data: ${JSON.stringify(payload)}\n\n`);
      });
    });
  }

  addClient(gameCode: number, res: Response): string {
    const client = {
      id: uuidv4(),
      gameCode,
      res,
    };
    this.clients.push(client);

    logger.debug({
      message: 'Client connected',
      id: client.id,
      game: gameCode,
      clientCount: this.clients.length,
    });

    return client.id;
  }

  removeClient(clientId: string): void {
    this.clients = this.clients.filter((c) => c.id !== clientId);

    logger.debug({
      message: 'Client disconnected',
      id: clientId,
      clientCount: this.clients.length,
    });
  }

  notifyGameClients<T>(gameCode: number, eventName: Events, data: Exclude<T, Promise<any>>) {
    this.publisher.publishMessage(gameCode, eventName, data);
  }
}
