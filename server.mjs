import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 4302;
const configuredBackendOrigin = String(process.env.VITE_SHOW_BACKEND_URL || process.env.SHOW_BACKEND_URL || '').replace(/\/$/, '');
const lanHost = String(process.env.VITE_LAN_HOST || '').trim();

function isLocalAddress(value) {
  return /(^|\/\/)localhost(?::|\/|$)|(^|\/\/)127\.0\.0\.1(?::|\/|$)|(^|\/\/)0\.0\.0\.0(?::|\/|$)/i.test(String(value || ''));
}
const host = process.env.HOST || '0.0.0.0';
const isLiveMode = process.env.NODE_ENV === 'production' || process.env.VJ_LIVE_MODE === '1';
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

let latestState = null;
let clientCount = 0;

const send = (socket, message) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcast = (message, except) => {
  for (const client of wss.clients) {
    if (client !== except) {
      send(client, message);
    }
  }
};

wss.on('connection', (socket) => {
  clientCount += 1;
  send(socket, { type: 'sync-status', payload: { connected: clientCount } });

  if (latestState) {
    send(socket, { type: 'screen-state', payload: latestState });
  }

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === 'controller-state') {
        latestState = message.payload;
        broadcast({ type: 'screen-state', payload: latestState }, socket);
      }

      if (message.type === 'controller-signal') {
        broadcast({ type: 'screen-signal', payload: message.payload }, socket);
      }

      if (message.type === 'screen-hello') {
        send(socket, {
          type: 'sync-status',
          payload: { connected: clientCount, screenId: message.payload?.screenId },
        });
        if (latestState) {
          send(socket, { type: 'screen-state', payload: latestState });
        }
      }
    } catch (error) {
      send(socket, { type: 'sync-error', payload: { message: 'Invalid sync message' } });
    }
  });

  socket.on('close', () => {
    clientCount = Math.max(0, clientCount - 1);
    broadcast({ type: 'sync-status', payload: { connected: clientCount } });
  });
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/sync') {
    return;
  }

  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit('connection', websocket, request);
  });
});

app.get('/api/sync/status', (_request, response) => {
  response.json({
    connected: clientCount,
    hasState: Boolean(latestState),
  });
});

app.get('/api/network', (_request, response) => {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const infos of Object.values(interfaces)) {
    for (const info of infos || []) {
      const isBenchmarkRange = info.address.startsWith('198.18.') || info.address.startsWith('198.19.');
      if (info.family === 'IPv4' && !info.internal && !isBenchmarkRange) {
        addresses.push(`http://${info.address}:${port}`);
      }
    }
  }

  response.json({
    local: `http://localhost:${port}`,
    addresses,
  });
});

function getRequestHostName(request) {
  try {
    return new URL(`http://${request.headers.host || 'localhost'}`).hostname;
  } catch {
    return 'localhost';
  }
}

function resolveBackendOrigin(request) {
  if (configuredBackendOrigin && !isLocalAddress(configuredBackendOrigin)) return configuredBackendOrigin;
  if (lanHost) return `http://${lanHost}:4300`;
  return `http://${getRequestHostName(request)}:4300`;
}

// Proxy for /api requests to the backend.
// This must come AFTER local /api routes and BEFORE the app shell.
app.use('/api', async (req, res, next) => {
  const url = req.originalUrl || req.url;
  
  // 1. Check for local routes first (explicitly)
  if (url === '/api/sync/status' || url === '/api/network') {
    return next();
  }

  const targetOrigin = resolveBackendOrigin(req);
  console.log(`[Proxy] Forwarding: ${req.method} ${url} -> ${targetOrigin}${url}`);
  
  try {
    const targetUrl = `${targetOrigin}${url}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(targetOrigin).host,
        'connection': 'keep-alive'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    const data = await response.text();

    if (contentType && contentType.includes('text/html')) {
      console.error(`[Proxy] Backend returned HTML for ${url}. This usually means the route does not exist on the API server (404) or the API server is returning a fallback page.`);
      res.status(response.status).send(data);
      return;
    }

    res.setHeader('content-type', contentType || 'application/json');
    res.status(response.status).send(data);
  } catch (error) {
    console.error(`[Proxy] Connection Error: ${error.message}`);
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Backend API at ${targetOrigin} is not reachable. Please ensure vad.26.api is running.`,
      details: error.message
    });
  }
});


if (isLiveMode) {
  const distDir = path.join(__dirname, 'dist');
  app.use(express.static(distDir));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    configLoader: 'runner',
    server: {
      middlewareMode: true,
      hmr: {
        server,
        clientPort: port,
        path: '/__vite_hmr',
      },
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);
}

server.listen(port, host, () => {
  console.log(`NEONPULSE controller: http://localhost:${port}/ (${isLiveMode ? 'live' : 'dev'})`);
  console.log(`Screen sync websocket: ws://localhost:${port}/sync`);
});
