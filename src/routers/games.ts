import { Router } from 'express';
import { handlerWrapper } from './utils';
import {
  createGame,
  gameEvents,
  getGame,
  joinGame,
  playerReady,
  selectImage,
  deselectImage,
  vote,
} from './../controllers/games';
import { ClientNotifier } from '../services/clientNotifier';
import { GameService } from '../services/gameService';

export default function GamesRouter(notifier: ClientNotifier, gameService: GameService) {
  const router = Router();
  router.post('/', handlerWrapper(createGame(gameService)));
  router.get('/:code', handlerWrapper(getGame(gameService)));
  router.post('/:code/join', handlerWrapper(joinGame(notifier, gameService)));
  router.post('/:code/ready', handlerWrapper(playerReady(notifier, gameService)));
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', handlerWrapper(selectImage(notifier, gameService)));
  router.post('/:code/rounds/:order/images/deselect', handlerWrapper(deselectImage(notifier, gameService)));
  router.post('/:code/rounds/:order/vote', handlerWrapper(vote(notifier, gameService)));
  router.get('/:code/events', handlerWrapper(gameEvents(notifier, gameService)));
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.status(500).json('not implemented');
};
