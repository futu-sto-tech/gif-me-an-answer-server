import { RequestHandler } from 'express';
import httpContext from 'express-http-context';
import { v4 as uuidv4 } from 'uuid';

export const requestContext = (): RequestHandler => (req, _res, next) => {
  const id = uuidv4();
  httpContext.set('requestId', id);
  req.id = id;
  next();
};
