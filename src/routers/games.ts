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

export default function GamesRouter(notifier: ClientNotifier) {
  const router = Router();
  router.post('/', handlerWrapper(createGame));
  router.get('/:code', handlerWrapper(getGame));
  router.post('/:code/join', handlerWrapper(joinGame(notifier)));
  router.post('/:code/ready', handlerWrapper(playerReady(notifier)));
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', handlerWrapper(selectImage(notifier)));
  router.post('/:code/rounds/:order/images/deselect', handlerWrapper(deselectImage(notifier)));
  router.post('/:code/rounds/:order/vote', handlerWrapper(vote(notifier)));
  router.get('/:code/events', handlerWrapper(gameEvents(notifier)));
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.status(500).json('not implemented');
};
