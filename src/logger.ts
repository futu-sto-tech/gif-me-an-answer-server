import winston from 'winston';
import httpContext from 'express-http-context';
import config from './config';

const options: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      level: config.LOGGER_LEVEL,
      silent: config.isTest,
    }),
  ],
  format: winston.format.combine(
    winston.format((info) => {
      const requestId = info.requestId || httpContext.get('requestId') || 'noRequestId';
      info.requestId = requestId;
      return info;
    })(),
    winston.format.json()
  ),
};

const logger = winston.createLogger(options);

logger.info(`Logging initialized at '${config.LOGGER_LEVEL}' level`);

export default logger;
