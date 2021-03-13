require('dotenv').config();
import './types/common';

import path from 'path';
import GamesRouter from './routers/games';
import GifsRouter from './routers/gifs';
import bodyParser from 'body-parser';
import config from './config';
import cors from 'cors';
import express from 'express';
import errorHandler from './middleware/errorHandler';
import logger from './logger';
import httpContext from 'express-http-context';
import { requestContext } from './middleware/requestContext';
import { requestLogger } from './middleware/requestLogger';
import { ClientNotifier } from './services/clientNotifier';
import { GameService } from './services/gameService';

const app = express();

app.use(httpContext.middleware);
app.use(cors());
app.use(requestContext());
app.use(requestLogger());
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.get('/api-spec', (_req, res) => {
  res.sendFile(path.resolve(__dirname, './api-spec.yaml'));
});

const notifier = new ClientNotifier();
const gameService = new GameService();

app.use('/api/v1/games', GamesRouter(notifier, gameService));
app.use('/api/v1/gifs', GifsRouter());

app.use(errorHandler());

const cleanup = () => {
  logger.info({ message: 'Server cleanup finished' });
  process.exit(0);
};

// Ensures Docker can shutdown the process correctly
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

app.listen(config.PORT, () => logger.info({ message: `Running on ${config.PORT}!` }));
