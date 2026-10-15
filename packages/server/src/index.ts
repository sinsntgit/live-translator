import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientToServerMessage, ServerToClientMessage } from '@live-translator/shared';
import { config } from './config.js';
import { SonioxRelay } from './sonioxRelay.js';

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: '/session' });

wss.on('connection', (clientWs) => {
  const send = (msg: ServerToClientMessage) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(msg));
    }
  };

  const relay = new SonioxRelay(send);

  clientWs.on('message', (data, isBinary) => {
    if (isBinary) {
      relay.sendAudio(data as Buffer);
      return;
    }
    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'start') {
      relay.start(msg.config);
    } else if (msg.type === 'stop') {
      relay.stop();
    }
  });

  clientWs.on('close', () => relay.stop());
  clientWs.on('error', () => relay.stop());
});

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${config.port} is already in use. Close the other instance, or set PORT in your .env.`
      : `Server error: ${err.message}`
  );
  process.exit(1);
});

// Loopback only: the relay spends the Soniox API key, so it must not be
// reachable from other machines on the network.
httpServer.listen(config.port, '127.0.0.1', () => {
  console.log(`live-translator backend relay listening on 127.0.0.1:${config.port}`);
  // When started by the Electron app, tell it which port we ended up on.
  process.send?.({ type: 'ready', port: config.port });
});
