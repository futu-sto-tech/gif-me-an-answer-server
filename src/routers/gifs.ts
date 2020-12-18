import { Router } from 'express';
import { searchGifs } from '../controllers/gifs';
import { handlerWrapper } from './utils';

export default function GifsRouter() {
  const router = Router();
  router.post('/search', handlerWrapper(searchGifs));

  return router;
}
