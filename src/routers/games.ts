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
import { Services } from '../types';

export default function GamesRouter(services: Services) {
  const router = Router();
  router.post('/', handlerWrapper(createGame(services)));
  router.get('/:code', handlerWrapper(getGame(services)));
  router.post('/:code/join', handlerWrapper(joinGame(services)));
  router.post('/:code/ready', handlerWrapper(playerReady(services)));
  router.post('/:code/rounds/:order/done', NotImplemented);
  router.post('/:code/rounds/:order/images', handlerWrapper(selectImage(services)));
  router.post('/:code/rounds/:order/images/deselect', handlerWrapper(deselectImage(services)));
  router.post('/:code/rounds/:order/vote', handlerWrapper(vote(services)));
  router.get('/:code/events', handlerWrapper(gameEvents(services)));
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.status(500).json('not implemented');
};
