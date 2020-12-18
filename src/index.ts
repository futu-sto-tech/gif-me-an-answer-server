import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import captionData from './data/captions.json';

const port = process.env.PORT || 8000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.get('/captions', (_req, res) => {
  res.json(captionData);
});

app.listen(port, () => console.log(`Running on ${port}!`));
