import { RequestHandler, Router } from 'express';

import { search } from '../services/giphy';

export default function GifsRouter() {
  const router = Router();
  router.post('/search', Search);
  router.get('/test', NotImplemented);
  return router;
}

const NotImplemented = (_req: any, res: any) => {
  res.json('not implemented');
};

const Search = async (req: any, res: any) => {
  const { query } = req.body;

  const data = await search(query);
  res.json(data);
};
