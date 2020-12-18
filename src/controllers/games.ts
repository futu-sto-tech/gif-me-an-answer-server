import { NextFunction, Request, Response } from 'express';
import codeGenerator from '../codeGenerator';
import { Game, GameRound, GameStatus, GameRoundStatus, Player, PlayerStatus } from '../types';
import * as gameService from '../services/gameService';
import CAPTIONS_JSON from '../data/captions.json';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger';

const CAPTIONS_SIZE = CAPTIONS_JSON.length;

function getRandomInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}

// Gets an unique array of captions
const getCaptions = (length: number): string[] => {
  const selectedCaptionIndexes: number[] = [];
  while (selectedCaptionIndexes.length < length) {
    const n = getRandomInt(CAPTIONS_SIZE);
    if (!selectedCaptionIndexes.includes(n)) {
      selectedCaptionIndexes.push(n);
    }
  }
  return selectedCaptionIndexes.map((i) => CAPTIONS_JSON[i].caption);
};

const createRounds = (rounds: number): GameRound[] => {
  const captions = getCaptions(rounds);
  const gameRounds = Array(rounds)
    .fill('')
    .map((n, i) => ({
      order: i,
      status: GameRoundStatus.SELECT_GIF,
      caption: captions[i],
      images: [],
      presentImage: '',
    }));

  return gameRounds;
};

export async function createGame(req: Request<{ rounds: number; players: number }>, res: Response) {
  const totalRounds = Number(req.body.rounds);
  const totalPlayers = Number(req.body.players);
  const newGame: Game = {
    code: codeGenerator(),
    players: [],
    status: GameStatus.ACTIVE,
    totalRounds,
    totalPlayers,
    rounds: createRounds(totalRounds),
  };
  gameService.addGame(newGame);
  res.json(newGame);
  return;
}

export function getGame(req: Request, res: Response) {
  const code = Number(req.params.code);
  const game = gameService.getGame(code);
  if (game) {
    res.json(game);
    return;
  }
  res.status(404);
  return;
}

export function joinGame(req: Request, res: Response) {
  const code = Number(req.params.code);
  const name = req.body.name;

  const player: Player = {
    id: uuidv4(),
    name,
    status: PlayerStatus.JOINED,
    points: 0,
  };
  gameService.addPlayer(code, player);

  notifyPlayers(code, 'player-joined', gameService.getGame(code));

  res.sendStatus(200);
  return;
}

interface Client {
  id: string;
  gameCode: number;
  res: Response;
}

let clients: Client[] = [];

function notifyPlayers<T>(gameCode: number, eventName: string, data: T) {
  const players = clients.filter((c) => c.gameCode === gameCode);

  const payload = {
    event: eventName,
    data,
  };

  players.forEach((p) => {
    p.res.write(`${JSON.stringify(payload)}\n\n`);
  });
}

export function eventsHandler(req: Request, res: Response) {
  const { code } = req.params;

  const gameCode = Number(code);
  const game = gameService.getGame(gameCode);

  if (!game) {
    res.status(404).json({ message: `No game exists with code ${gameCode}` });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  });

  const client: Client = {
    id: uuidv4(),
    gameCode,
    res,
  };

  clients.push(client);
  logger.info({
    message: 'Client connected',
    id: client.id,
    game: gameCode,
    clientCount: clients.length,
  });

  req.on('close', () => {
    clients = clients.filter((c) => c.id !== client.id);
    logger.info({
      message: 'Client disconnected',
      id: client.id,
      game: gameCode,
      clientCount: clients.length,
      requestId: req.id,
    });
  });
}
