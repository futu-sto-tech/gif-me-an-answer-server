import { RequestHandler } from 'express';

export const handlerWrapper = <P extends {}>(fn: RequestHandler<P>): RequestHandler<P> => async (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
