import { Request, Response } from 'express';
import { Events, Game, GameRound, GameRoundStatus, GameStatus, PlayerStatus, Services } from '../types';
import CAPTIONS_JSON from '../data/captions.json';
import codeGenerator from '../codeGenerator';
import { Err, isErr } from '../utils';
import logger from '../logger';
import { GameServiceErrors } from '../services/gameService';

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

const handleError = ({ error }: Err<GameServiceErrors>, res: Response): Response => {
  switch (error) {
    case 'no-such-game':
      return res.sendStatus(404);
    case 'no-such-player':
    case 'player-exists':
    case 'no-such-image':
    case 'game-exists':
      return res.status(400).json({ message: error });
    case 'bad-round-state':
      return res.status(500).json({ message: error });
    default: {
      logger.warn('Unhandled game service error:', error);
      return res.status(500).json({ message: error });
    }
  }
};

export const createGame = ({ gameService }: Services) => async (
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
    revision: 1,
  };
  const result = await gameService.addGame(newGame);

  if (isErr(result)) {
    return handleError(result, res);
  }

  res.json(newGame);
};

export const getGame = ({ gameService }: Services) => async (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const game = await gameService.getGame(code);

  if (isErr(game)) {
    return handleError(game, res);
  }

  res.json(game);
};

export const playerReady = ({ notifier, gameService }: Services) => async (
  req: Request<{ code: number }, any, { player: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const playerId = req.body.player;

  const result = await gameService.playerReady(gameCode, playerId);

  if (isErr(result)) {
    return handleError(result, res);
  }

  notifier.notifyGameClients(gameCode, Events.PlayerReady, result);

  const allReady = await gameService.allPlayersReady(gameCode);

  if (isErr(allReady)) {
    return handleError(allReady, res);
  }

  if (allReady) {
    notifier.notifyGameClients(gameCode, Events.GameReady, await gameService.getGame(gameCode));
    const updatedGame = await gameService.startNewRound(gameCode);
    notifier.notifyGameClients(gameCode, Events.RoundStarted, updatedGame);
  }

  res.sendStatus(200);
};

export const joinGame = ({ notifier, gameService }: Services) => async (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const name = req.body.name;
  const isHost: boolean = req.body.isHost || false;

  const player = await gameService.addPlayer(code, name, isHost);

  if (isErr(player)) {
    return handleError(player, res);
  }

  notifier.notifyGameClients(code, Events.PlayerJoined, await gameService.getGame(code));

  res.json(player);
};

export const forceStartGame = ({ notifier, gameService }: Services) => async (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const game = await gameService.getGame(code);

  if (isErr(game)) {
    return handleError(game, res);
  }

  const newCount = game.players.length;

  gameService.changePlayerCount(game.code, newCount);

  notifier.notifyGameClients(code, Events.GameReady, await gameService.getGame(code));
  const updatedGame = await gameService.startNewRound(code);
  notifier.notifyGameClients(code, Events.RoundStarted, updatedGame);

  res.sendStatus(200);
};

export const selectImage = ({ notifier, gameService }: Services) => async (
  req: Request<{ code: number; order: number }, any, { player: string; url: string }>,
  res: Response
) => {
  const imagePresentationDuration = 5 * 1000;
  const gameCode = Number(req.params.code);
  const { player, url } = req.body;

  const maybeGame = await gameService.selectImage(gameCode, player, url);

  if (isErr(maybeGame)) {
    return handleError(maybeGame, res);
  }

  notifier.notifyGameClients(gameCode, Events.PlayerSelectedGif, maybeGame);

  const allSelected = await gameService.allPlayersInState(gameCode, PlayerStatus.SELECTED_GIF);

  if (isErr(allSelected)) {
    return handleError(allSelected, res);
  }

  if (allSelected) {
    const game = await gameService.startPresentation(gameCode);

    if (isErr(game)) {
      return handleError(game, res);
    }

    notifier.notifyGameClients(gameCode, Events.RoundStateChanged, game);
    const round = game.rounds.find((r) => r.status === GameRoundStatus.PRESENT);

    if (!round) {
      return res.json(game);
    }

    round.images.forEach((image, idx) => {
      setTimeout(async () => {
        const g = await gameService.setPresentedImage(gameCode, image);
        notifier.notifyGameClients(gameCode, Events.RoundImagePresented, g);
      }, imagePresentationDuration * idx);
    });

    setTimeout(async () => {
      const g = await gameService.startVote(gameCode);
      notifier.notifyGameClients(gameCode, Events.RoundStateChanged, g);
    }, imagePresentationDuration * round.images.length);
  }

  res.json(maybeGame);
};

export const deselectImage = ({ notifier, gameService }: Services) => async (
  req: Request<{ code: number; order: number }, any, { player: string; url: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const roundNumber = Number(req.params.order);
  const { player, url } = req.body;

  const maybeGame = await gameService.deselectImage(gameCode, roundNumber, player, url);

  if (isErr(maybeGame)) {
    return handleError(maybeGame, res);
  }

  notifier.notifyGameClients(gameCode, Events.PlayerDeselectedGif, maybeGame);

  return res.sendStatus(200);
};

export const vote = ({ notifier, gameService }: Services) => async (
  req: Request<{ code: string; order: string }, any, { player: string; image: string }>,
  res: Response
) => {
  const code = Number(req.params.code);
  const playerId = req.body.player;
  const imageId = req.body.image;

  const maybeGame = await gameService.vote(code, playerId, imageId);

  if (isErr(maybeGame)) {
    return handleError(maybeGame, res);
  }

  notifier.notifyGameClients(code, Events.PlayerVoted, maybeGame);

  const allVoted = await gameService.allPlayersInState(code, PlayerStatus.VOTED);

  if (isErr(allVoted)) {
    return handleError(allVoted, res);
  }

  if (allVoted) {
    await gameService.assignPoints(code);
    const game = await gameService.finishRound(code);
    notifier.notifyGameClients(code, Events.RoundStateChanged, game);

    setTimeout(async () => {
      const currentGame = await gameService.getGame(code);

      if (isErr(currentGame)) {
        logger.error({ message: 'Failed to progress after voting', gameCode: code });
        return;
      }

      if (currentGame.currentRound === currentGame.totalRounds) {
        const g = await gameService.finishGame(code);
        notifier.notifyGameClients(code, Events.GameFinished, g);
      } else {
        await gameService.nextRound(code);
        const g = await gameService.startImageSelection(code);
        notifier.notifyGameClients(code, Events.RoundStarted, g);
      }
    }, 10 * 1000);
  }

  res.json(maybeGame);
};

export const gameEvents = ({ notifier, gameService }: Services) => async (req: Request, res: Response) => {
  const { code } = req.params;

  const gameCode = Number(code);
  const game = await gameService.getGame(gameCode);

  if (isErr(game)) {
    return handleError(game, res);
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
function changePlayerCount() {
  throw new Error('Function not implemented.');
}
