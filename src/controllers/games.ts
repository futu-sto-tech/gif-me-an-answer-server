import { Request, Response } from 'express';
import codeGenerator from '../codeGenerator';
import { Game, GameRound, GameStatus, GameRoundStatus } from '../types';
import * as gameService from '../service/gameService';
import CAPTIONS_JSON from '../data/captions.json';

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

export async function createGame(req: Request, res: Response) {
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

export async function getGame(req: Request, res: Response) {
  const code = Number(req.params.code);
  const game = gameService.getGame(code);
  if (game) {
    res.json(game);
    return;
  }
  res.status(400);
  return;
}
