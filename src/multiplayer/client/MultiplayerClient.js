import { CLIENT_MESSAGE_TYPES, makeEnvelope } from '../contracts/messages';

export class MultiplayerClient {
  constructor({ url, onMessage, onStateChange } = {}) {
    this.url = url || '';
    this.onMessage = onMessage || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.socket = null;
    this.state = 'idle';
  }

  connect({ playerId, authToken } = {}) {
    if (!this.url || this.state === 'connecting' || this.state === 'connected') return;
    this.state = 'connecting';
    this.onStateChange(this.state);

    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.state = 'connected';
      this.onStateChange(this.state);
      this.send(
        CLIENT_MESSAGE_TYPES.HELLO,
        { playerId: playerId || null, authToken: authToken || null }
      );
    };

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.onMessage(parsed);
      } catch {
        this.onMessage({ type: 'server.error', payload: { reason: 'invalid_json' } });
      }
    };

    this.socket.onerror = () => {
      this.state = 'error';
      this.onStateChange(this.state);
    };

    this.socket.onclose = () => {
      this.state = 'closed';
      this.onStateChange(this.state);
      this.socket = null;
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.state = 'idle';
    this.onStateChange(this.state);
  }

  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(makeEnvelope(type, payload)));
  }

  sendHeartbeat() {
    this.send(CLIENT_MESSAGE_TYPES.HEARTBEAT, {});
  }
}

