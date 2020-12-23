import { Router } from 'express';
import { handlerWrapper } from './utils';
import { createGame, gameEvents, getGame, joinGame } from './../controllers/games';
import { ClientNotifier } from '../services/clientNotifier';

export default function GamesRouter(notifier: ClientNotifier) {
  const router = Router();
  router.post('/', handlerWrapper(createGame));
  router.get('/:code', handlerWrapper(getGame));
  router.post('/:code/join', handlerWrapper(joinGame(notifier)));
  router.post('/:code/ready', NotImplemented);
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', NotImplemented);
  router.post('/:code/rounds/:order/vote', NotImplemented);
  router.get('/:code/events', handlerWrapper(gameEvents(notifier)));
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.json('not implemented');
};
