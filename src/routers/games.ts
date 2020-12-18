import { createGame } from './../controllers/games';
import { RequestHandler, Router } from 'express';

export const handlerWrapper = (fn: RequestHandler): RequestHandler => async (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default function GamesRouter() {
  const router = Router();
  router.post('/games', handlerWrapper(createGame));
  router.get('/games/:code', NotImplemented);
  router.post('/games/:code/join', NotImplemented);
  router.post('/games/:code/ready', NotImplemented);
  router.post('/games/:code/rounds/:order/done', NotImplemented);
  router.post('/games/:code/rounds/:order/images', NotImplemented);
  router.post('/games/:code/rounds/:order/vote', NotImplemented);
  router.post('/games/:code/events', NotImplemented);
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.json('not implemented');
};
