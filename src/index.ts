import express from 'express';
import cors from 'cors';

const port = process.env.PORT || 8000;

const app = express();
app.use(cors());

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.get('/captions', (_req, res) => {
  const captions = require('./data/captions.json');
  res.json(captions);
});

app.listen(port, () => console.log(`Running on ${port}!`));
