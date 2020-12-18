import { RequestHandler } from 'express';
import logger from '../logger';

export const requestLogger = (): RequestHandler => (req, _res, next) => {
  logger.info({
    method: req.method.toUpperCase(),
    url: `${req.baseUrl ?? ''}${req.url}`,
    origin: req.ips,
    headers: req.headers,
  });
  next();
};
