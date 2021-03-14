import { Request, Response } from 'express';
import { Events, Game, GameRound, GameRoundStatus, GameStatus, PlayerStatus, Services } from '../types';
import CAPTIONS_JSON from '../data/captions.json';
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
  };
  await gameService.addGame(newGame);

  res.json(newGame);
};

export const getGame = ({ gameService }: Services) => async (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const game = await gameService.getGame(code);
  if (game) {
    res.json(game);
    return;
  }

  res.sendStatus(404);
};

export const playerReady = ({ notifier, gameService }: Services) => async (
  req: Request<{ code: number }, any, { player: string }>,
  res: Response
) => {
  const gameCode = Number(req.params.code);
  const playerId = req.body.player;

  const result = await gameService.playerReady(gameCode, playerId);

  if (isErr(result)) {
    return result.error === 'no-such-game' ? res.sendStatus(404) : res.status(400).json({ message: result.error });
  }
  notifier.notifyGameClients(gameCode, Events.PlayerReady, result);

  const allReady = gameService.allPlayersReady(gameCode);
  if (!isErr(allReady) && allReady) {
    notifier.notifyGameClients(gameCode, Events.GameReady, await gameService.getGame(gameCode));
    const updatedGame = await gameService.startNewRound(gameCode);
    notifier.notifyGameClients(gameCode, Events.RoundStarted, updatedGame);
  }

  res.sendStatus(200);
};

export const joinGame = ({ notifier, gameService }: Services) => async (req: Request, res: Response) => {
  const code = Number(req.params.code);
  const name = req.body.name;

  const player = await gameService.addPlayer(code, name);

  if (isErr(player)) {
    return player.error === 'no-such-game' ? res.sendStatus(404) : res.status(400).json({ message: player.error });
  }

  notifier.notifyGameClients(code, Events.PlayerJoined, await gameService.getGame(code));

  res.json(player);
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
    return maybeGame.error === 'no-such-player'
      ? res.status(400).json({ message: maybeGame.error })
      : res.sendStatus(404);
  }

  notifier.notifyGameClients(gameCode, Events.PlayerSelectedGif, maybeGame);

  const allSelected = await gameService.allPlayersInState(gameCode, PlayerStatus.SELECTED_GIF);
  if (!isErr(allSelected) && allSelected) {
    const game = await gameService.startPresentation(gameCode);

    if (isErr(game)) {
      logger.error({ message: 'Something went wrong when selecting image', gameCode, player, url });
      return res.sendStatus(500);
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
      const g = gameService.startVote(gameCode);
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
    switch (maybeGame.error) {
      case 'no-such-game':
      case 'no-such-round':
        return res.sendStatus(404);
      case 'no-such-image':
        return res.status(400).json({ message: `No matching image`, player, url });
      case 'bad-round-state':
        return res.sendStatus(500);
      default:
        throw new Error(`Unhandled error state when deselecting image: ${maybeGame.error}`);
    }
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
    return maybeGame.error === 'no-such-game'
      ? res.sendStatus(404)
      : res.status(400).json({ message: maybeGame.error });
  }

  notifier.notifyGameClients(code, Events.PlayerVoted, maybeGame);

  const allVoted = await gameService.allPlayersInState(code, PlayerStatus.VOTED);
  if (!isErr(allVoted) && allVoted) {
    await gameService.assignPoints(code);
    const game = await gameService.finishRound(code);
    notifier.notifyGameClients(code, Events.RoundStateChanged, game);

    setTimeout(async () => {
      const currentGame = await gameService.getGame(code);

      if (isErr(currentGame)) {
        logger.error({ message: 'Failed to progress after voting', gameCode: code });
        return;
      }

      if (currentGame && currentGame.currentRound === currentGame.totalRounds) {
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
