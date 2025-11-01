const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Tillad localhost og dine hosting-domæner
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://sladeshultimate-1.web.app',
  'https://sladeshultimate-1.firebaseapp.com'
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// (resten af filen uændret)
webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  setCors(req, res); // <-- VIGTIGT: giv req med her

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};

    let subscription = body.subscription;
    const message = body.message || 'Test besked';
    const url = body.url || '/';

    if (!subscription) {
      const p = path.join(process.cwd(), 'subscriptions', 'dummy.json');
      if (fs.existsSync(p)) {
        subscription = JSON.parse(fs.readFileSync(p, 'utf8'));
      } else {
        return res.status(400).send('No subscription provided and no dummy.json found.');
      }
    }

    const payload = JSON.stringify({ title: 'SladeshPro', body: message, url });
    await webpush.sendNotification(subscription, payload);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    if (err.statusCode) {
      res.status(err.statusCode).send(err.body || String(err));
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
};
