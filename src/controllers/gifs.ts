import { Request, Response } from 'express';
import * as giphyService from '../services/giphy';

export const searchGifs = async (req: Request<{ query: string }>, res: Response) => {
  const { query } = req.body;

  const data = await giphyService.search(query);
  res.json(data);
};
