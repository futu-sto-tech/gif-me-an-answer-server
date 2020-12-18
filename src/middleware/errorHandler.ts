import { ErrorRequestHandler } from 'express';
import logger from '../logger';

export default function errorHandler(): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (!err) {
      next();
    }

    logger.error({
      message: err.message,
      stack: err.stack,
      requestId: req.id,
    });

    res.status(500).json({ message: 'Something went wrong :(' });
  };
}
