export const SERVER_EVENTS = Object.freeze({
  HELLO_ACK: 'server.hello_ack',
  ROOM_STATE: 'server.room_state',
  MATCH_EVENT: 'server.match_event',
  ERROR: 'server.error',
});

export const CLIENT_EVENTS = Object.freeze({
  HELLO: 'client.hello',
  HEARTBEAT: 'client.heartbeat',
  INPUT_FRAME: 'client.input_frame',
  JOIN_ROOM: 'client.join_room',
  LEAVE_ROOM: 'client.leave_room',
});

export function serverEnvelope(type, payload = {}) {
  return {
    type,
    ts: Date.now(),
    payload,
  };
}

