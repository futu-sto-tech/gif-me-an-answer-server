require('dotenv').config();

import GamesRouter from './routers/games';
import GifsRouter from './routers/gifs';
import bodyParser from 'body-parser';
import captionData from './data/captions.json';
import config from './config';
import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.get('/captions', (_req, res) => {
  res.json(captionData);
});

app.use('/api/v1/games', GamesRouter());
app.use('/api/v1/gifs', GifsRouter());

app.use('/api/v1', GamesRouter());
app.listen(config.PORT, () => console.log(`Running on ${config.PORT}!`));
