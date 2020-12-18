import { createGame, getGame } from './../controllers/games';
import { RequestHandler, Router } from 'express';

export const handlerWrapper = (fn: RequestHandler): RequestHandler => async (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default function GamesRouter() {
  const router = Router();
  router.post('/', handlerWrapper(createGame));
  router.get('/:code', handlerWrapper(getGame));
  router.post('/:code/join', NotImplemented);
  router.post('/:code/ready', NotImplemented);
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', NotImplemented);
  router.post('/:code/rounds/:order/vote', NotImplemented);
  router.post('/:code/events', NotImplemented);
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.json('not implemented');
};
