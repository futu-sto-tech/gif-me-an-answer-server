import { GameService } from '../services/gameService';

import { Events, Game, GameRound, GameRoundStatus, GameStatus, PlayerStatus } from '../types';
import { Request, Response } from 'express';

import CAPTIONS_JSON from '../data/captions.json';
import { ClientNotifier } from '../services/clientNotifier';
import codeGenerator from '../codeGenerator';
import { isErr } from '../utils';
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
    .map((_n, i) => ({
      order: i + 1,
      status: GameRoundStatus.NOT_STARTED,
      caption: captions[i],
      images: [],
      presentImage: '',
    }));

  return gameRounds;
};

export const createGame = (gameService: GameService) => async (
  req: Request<{}, any, { rounds: number; players: number }>,
  res: Response
) => {
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
};

export const getGame = (gameService: GameService) => (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const game = gameService.getGame(code);
  if (game) {
    res.json(game);
    return;
  }

  res.sendStatus(404);
};

export const playerReady = (notifier: ClientNotifier, gameService: GameService) => (
  req: Request<{ code: number }, any, { player: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const playerId = req.body.player;

  const result = gameService.playerReady(gameCode, playerId);

  if (isErr(result)) {
    return result.error === 'no-such-game' ? res.sendStatus(404) : res.status(400).json({ message: result.error });
  }
  notifier.notifyGameClients(gameCode, Events.PlayerReady, gameService.getGame(gameCode));

  const allReady = gameService.allPlayersReady(gameCode);
  if (!isErr(allReady) && allReady) {
    notifier.notifyGameClients(gameCode, Events.GameReady, gameService.getGame(gameCode));
    gameService.startNewRound(gameCode);
    notifier.notifyGameClients(gameCode, Events.RoundStarted, gameService.getGame(gameCode));
  }

  res.sendStatus(200);
};

export const joinGame = (notifier: ClientNotifier, gameService: GameService) => (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const name = req.body.name;

  const player = gameService.addPlayer(code, name);

  if (isErr(player)) {
    return player.error === 'no-such-game' ? res.sendStatus(404) : res.status(400).json({ message: player.error });
  }

  notifier.notifyGameClients(code, Events.PlayerJoined, gameService.getGame(code));

  res.json(player);
};

export const selectImage = (notifier: ClientNotifier, gameService: GameService) => (
  req: Request<{ code: number; order: number }, any, { player: string; url: string }>,
  res: Response
) => {
  const imagePresentationDuration = 5 * 1000;
  const gameCode = Number(req.params.code);
  const { player, url } = req.body;

  const result = gameService.selectImage(gameCode, player, url);
  const game = gameService.getGame(gameCode);

  if (isErr(result)) {
    return result.error === 'no-such-player' ? res.status(400).json({ message: result.error }) : res.sendStatus(404);
  }
  if (isErr(game)) {
    return res.sendStatus(404);
  }

  notifier.notifyGameClients(gameCode, Events.PlayerSelectedGif, game);

  const allSelected = gameService.allPlayersInState(gameCode, PlayerStatus.SELECTED_GIF);
  if (!isErr(allSelected) && allSelected) {
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

export const deselectImage = (notifier: ClientNotifier, gameService: GameService) => (
  req: Request<{ code: number; order: number }, any, { player: string; url: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const roundNumber = Number(req.params.order);
  const { player, url } = req.body;

  const result = gameService.deselectImage(gameCode, roundNumber, player, url);

  if (isErr(result)) {
    switch (result.error) {
      case 'no-such-game':
      case 'no-such-round':
        return res.sendStatus(404);
      case 'no-such-image':
        return res.status(400).json({ message: `No matching image`, player, url });
      case 'bad-round-state':
        return res.sendStatus(500);
      default:
        throw new Error(`Unhandled error state when deselecting image: ${result.error}`);
    }
  }

  notifier.notifyGameClients(gameCode, Events.PlayerDeselectedGif, gameService.getGame(gameCode));

  return res.sendStatus(200);
};

export const vote = (notifier: ClientNotifier, gameService: GameService) => (
  req: Request<{ code: string; order: string }, any, { player: string; image: string }>,
  res: Response
) => {
  const code = Number(req.params.code);
  const playerId = req.body.player;
  const imageId = req.body.image;

  const result = gameService.vote(code, playerId, imageId);

  if (isErr(result)) {
    return result.error === 'no-such-game' ? res.sendStatus(404) : res.status(400).json({ message: result.error });
  }

  notifier.notifyGameClients(code, Events.PlayerVoted, gameService.getGame(code));

  // TODO: Do we need a timer here as well?
  if (gameService.allPlayersInState(code, PlayerStatus.VOTED)) {
    gameService.assignPoints(code);
    gameService.finishRound(code);
    notifier.notifyGameClients(code, Events.RoundStateChanged, gameService.getGame(code));

    setTimeout(() => {
      const currentGame = gameService.getGame(code);

      if (isErr(currentGame)) {
        logger.error({ message: 'Failed to progress after voting', gameCode: code });
        return;
      }

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

  res.json(gameService.getGame(code));
};

export const gameEvents = (notifier: ClientNotifier, gameService: GameService) => (req: Request, res: Response) => {
  const { code } = req.params;

  const gameCode = Number(code);
  const game = gameService.getGame(gameCode);

  if (isErr(game)) {
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
