import { Request, Response } from 'express';
import codeGenerator from '../codeGenerator';
import { Game, GameRound, GameStatus, GameRoundStatus, Player, PlayerStatus } from '../types';
import * as gameService from '../service/gameService';
import CAPTIONS_JSON from '../data/captions.json';
import { v4 as uuidv4 } from 'uuid';

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

<<<<<<< HEAD
export async function createGame(req: Request<{ rounds: number }>, res: Response) {
=======
export function createGame(req: Request, res: Response) {
>>>>>>> Add player to game service
  const totalRounds = Number(req.body.rounds);

  const newGame: Game = {
    code: codeGenerator(),
    players: [],
    status: GameStatus.ACTIVE,
    totalRounds,
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
  res.status(400);
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
  res.status(200);
  return;
}
