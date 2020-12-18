import { Router } from 'express';
import { handlerWrapper } from './utils';
import { createGame, eventsHandler, getGame, joinGame } from './../controllers/games';

export default function GamesRouter() {
  const router = Router();
  router.post('/', handlerWrapper(createGame));
  router.get('/:code', handlerWrapper(getGame));
  router.post('/:code/join', handlerWrapper(joinGame));
  router.post('/:code/ready', NotImplemented);
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', NotImplemented);
  router.post('/:code/rounds/:order/vote', NotImplemented);
  router.get('/:code/events', handlerWrapper(eventsHandler));
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.json('not implemented');
};
