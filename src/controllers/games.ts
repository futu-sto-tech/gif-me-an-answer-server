import * as gameService from '../services/gameService';

import { Events, Game, GameRound, GameRoundStatus, GameStatus, PlayerStatus } from '../types';
import { Request, Response } from 'express';

import CAPTIONS_JSON from '../data/captions.json';
import { ClientNotifier } from '../services/clientNotifier';
import codeGenerator from '../codeGenerator';

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
    .map((_n, i) => ({
      order: i + 1,
      status: GameRoundStatus.NOT_STARTED,
      caption: captions[i],
      images: [],
      presentImage: '',
    }));

  return gameRounds;
};

export async function createGame(req: Request<{}, any, { rounds: number; players: number }>, res: Response) {
  const totalRounds = Number(req.body.rounds);
  const totalPlayers = Number(req.body.players);
  const newGame: Game = {
    code: codeGenerator(),
    players: [],
    status: GameStatus.ACTIVE,
    totalRounds,
    currentRound: 1,
    totalPlayers,
    rounds: createRounds(totalRounds),
  };
  gameService.addGame(newGame);

  res.json(newGame);
}

export function getGame(req: Request, res: Response) {
  const code = Number(req.params.code);
  const game = gameService.getGame(code);
  if (game) {
    res.json(game);
    return;
  }

  res.sendStatus(404);
}

export const playerReady = (notifier: ClientNotifier) => (
  req: Request<{ code: number }, any, { player: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const playerId = req.body.player;

  gameService.playerReady(gameCode, playerId);
  notifier.notifyGameClients(gameCode, Events.PlayerReady, gameService.getGame(gameCode));

  if (gameService.allPlayersReady(gameCode)) {
    notifier.notifyGameClients(gameCode, Events.GameReady, gameService.getGame(gameCode));
    gameService.startNewRound(gameCode);
    notifier.notifyGameClients(gameCode, Events.RoundStarted, gameService.getGame(gameCode));
  }

  res.sendStatus(200);
};

export const joinGame = (notifier: ClientNotifier) => (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const name = req.body.name;

  const player = gameService.addPlayer(code, name);

  notifier.notifyGameClients(code, Events.PlayerJoined, gameService.getGame(code));

  res.json(player);
};

export const selectImage = (notifier: ClientNotifier) => (
  req: Request<{ code: number; order: number }, any, { player: string; url: string }>,
  res: Response
) => {
  const imagePresentationDuration = 5 * 1000;
  const gameCode = Number(req.params.code);
  const { player, url } = req.body;

  gameService.selectImage(gameCode, player, url);

  const game = gameService.getGame(gameCode);

  notifier.notifyGameClients(gameCode, Events.PlayerSelectedGif, game);

  if (gameService.allPlayersInState(gameCode, PlayerStatus.SELECTED_GIF)) {
    gameService.startPresentation(gameCode);
    notifier.notifyGameClients(gameCode, Events.RoundStateChanged, gameService.getGame(gameCode));
    const round = game?.rounds.find((r) => r.status === GameRoundStatus.PRESENT);

    if (!round) {
      res.json(game);
      return;
    }

    round.images.forEach((image, idx) => {
      setTimeout(() => {
        gameService.setPresentedImage(gameCode, image);
        notifier.notifyGameClients(gameCode, Events.RoundImagePresented, gameService.getGame(gameCode));
      }, imagePresentationDuration * idx);
    });

    setTimeout(() => {
      gameService.startVote(gameCode);
      notifier.notifyGameClients(gameCode, Events.RoundStateChanged, gameService.getGame(gameCode));
    }, imagePresentationDuration * round.images.length);
  }

  res.json(game);
};

export const vote = (notifier: ClientNotifier) => (
  req: Request<{ code: string; order: string }, any, { player: string; image: string }>,
  res: Response
) => {
  const code = Number(req.params.code);
  const playerId = req.body.player;
  const imageId = req.body.image;

  gameService.vote(code, playerId, imageId);

  const game = gameService.getGame(code);

  notifier.notifyGameClients(code, Events.PlayerVoted, game);

  // TODO: Do we need a timer here as well?
  if (gameService.allPlayersInState(code, PlayerStatus.VOTED)) {
    gameService.assignPoints(code);
    gameService.finishRound(code);
    notifier.notifyGameClients(code, Events.RoundStateChanged, gameService.getGame(code));

    setTimeout(() => {
      const currentGame = gameService.getGame(code);

      if (currentGame && currentGame.currentRound === currentGame.totalRounds) {
        gameService.finishGame(code);
        notifier.notifyGameClients(code, Events.GameFinished, gameService.getGame(code));
      } else {
        gameService.nextRound(code);
        gameService.startImageSelection(code);
        notifier.notifyGameClients(code, Events.RoundStarted, gameService.getGame(code));
      }
    }, 10 * 1000);
  }

  res.json(game);
};

export const gameEvents = (notifier: ClientNotifier) => (req: Request, res: Response) => {
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
  // Send the list of supported events to the client
  res.write(`data: ${JSON.stringify({ event: Events.Init, supportedEvents: Object.values(Events) })}\n\n`);

  const clientId = notifier.addClient(game.code, res);

  req.on('close', () => {
    notifier.removeClient(clientId);
  });
};
