const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'priceshooters-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`PriceShooters listening on http://localhost:${PORT}`);
});