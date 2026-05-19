import { WebSocketServer } from 'ws';
import { AuthoritativeSim } from '../sim/AuthoritativeSim.js';
import { CLIENT_EVENTS, SERVER_EVENTS, serverEnvelope } from '../protocol/messages.js';

export class MatchServer {
  constructor({ server, config }) {
    this.config = config;
    this.sim = new AuthoritativeSim({ tickRate: config.tickRate });
    this.wss = new WebSocketServer({ server, path: '/multiplayer/ws' });
    this.clients = new Map();
    this.tickHandle = null;
  }

  start() {
    this.wss.on('connection', (socket) => {
      const clientId = `c_${Math.random().toString(36).slice(2, 10)}`;
      this.clients.set(clientId, socket);

      socket.on('message', (raw) => {
        this.handleMessage(clientId, raw);
      });

      socket.on('close', () => {
        this.clients.delete(clientId);
      });
    });

    const tickInterval = Math.max(10, Math.floor(1000 / this.config.tickRate));
    this.tickHandle = setInterval(() => {
      const snapshot = this.sim.tick();
      this.broadcast(SERVER_EVENTS.ROOM_STATE, snapshot);
    }, tickInterval);
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
    this.wss.close();
  }

  handleMessage(clientId, raw) {
    let message = null;
    try {
      message = JSON.parse(String(raw));
    } catch {
      this.send(clientId, SERVER_EVENTS.ERROR, { reason: 'invalid_json' });
      return;
    }

    switch (message.type) {
      case CLIENT_EVENTS.HELLO:
        this.sim.upsertPlayer(clientId, { x: 0, y: 0, hp: 100, alive: true });
        this.send(clientId, SERVER_EVENTS.HELLO_ACK, { clientId });
        break;
      case CLIENT_EVENTS.INPUT_FRAME:
        this.sim.applyInput(clientId, message.payload || {});
        break;
      default:
        break;
    }
  }

  send(clientId, type, payload = {}) {
    const socket = this.clients.get(clientId);
    if (!socket || socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(serverEnvelope(type, payload)));
  }

  broadcast(type, payload = {}) {
    const body = JSON.stringify(serverEnvelope(type, payload));
    for (const socket of this.clients.values()) {
      if (socket.readyState === socket.OPEN) {
        socket.send(body);
      }
    }
  }
}

