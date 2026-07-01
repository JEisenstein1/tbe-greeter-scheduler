import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// Keep local browser testing on the same chat implementation as Vercel production.
// Vite proxies /api/* to this Express server during npm run dev.
// @ts-expect-error api/chat.js is intentionally plain JS for Vercel Edge runtime.
import chatHandler from '../api/chat.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const webReq = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.cookie || '',
      },
      body: JSON.stringify(req.body || {}),
    });
    const webRes = await chatHandler(webReq);
    const text = await webRes.text();
    res.status(webRes.status);
    const contentType = webRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.send(text);
  } catch (err: unknown) {
    console.error('Local chat proxy error', err);
    res.status(500).json({ error: 'Chat endpoint failed' });
  }
});

app.listen(3001, () => {
  console.log('TBE server listening on http://localhost:3001');
});
