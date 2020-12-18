require('dotenv').config();
import './types/common';

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

const app = express();

app.use(httpContext.middleware);
app.use(cors());
app.use(requestContext());
app.use(requestLogger());
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.use('/api/v1/games', GamesRouter());
app.use('/api/v1/gifs', GifsRouter());

app.use(errorHandler());

app.listen(config.PORT, () => logger.info({ message: `Running on ${config.PORT}!` }));
