import { MULTIPLAYER_SCHEMA_VERSION } from './schemaVersion';

export const CLIENT_MESSAGE_TYPES = Object.freeze({
  HELLO: 'client.hello',
  HEARTBEAT: 'client.heartbeat',
  INPUT_FRAME: 'client.input_frame',
  JOIN_ROOM: 'client.join_room',
  LEAVE_ROOM: 'client.leave_room',
});

export const SERVER_MESSAGE_TYPES = Object.freeze({
  HELLO_ACK: 'server.hello_ack',
  HEARTBEAT_ACK: 'server.heartbeat_ack',
  ROOM_STATE: 'server.room_state',
  MATCH_EVENT: 'server.match_event',
  ERROR: 'server.error',
});

export function makeEnvelope(type, payload = {}) {
  return {
    schemaVersion: MULTIPLAYER_SCHEMA_VERSION,
    type,
    ts: Date.now(),
    payload,
  };
}

