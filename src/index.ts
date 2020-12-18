require('dotenv').config();
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import captionData from './data/captions.json';
import config from './config';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.get('/captions', (_req, res) => {
  res.json(captionData);
});

app.listen(config.PORT, () => console.log(`Running on ${config.PORT}!`));
