import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger';
import { Events } from '../types';

interface Client {
  id: string;
  gameCode: number;
  res: Response;
}

export class ClientNotifier {
  private clients: Client[];

  constructor() {
    this.clients = [];
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

  notifyGameClients<T>(gameCode: number, eventName: Events, data: T) {
    const players = this.clients.filter((c) => c.gameCode === gameCode);

    players.forEach((p) => {
      p.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }
}
