import express from 'express';

const port = process.env.PORT || 8000;

const app = express();

app.get('/', (_req, res) => {
  res.json({ message: "I'm alive!!!" });
});

app.listen(port, () => console.log(`Running on ${port}!`));
