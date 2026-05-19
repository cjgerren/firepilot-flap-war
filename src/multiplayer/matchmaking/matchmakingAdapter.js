import { CLIENT_MESSAGE_TYPES } from '../contracts/messages';

export function createMatchmakingAdapter(client) {
  return {
    joinRoom(roomCode) {
      client.send(CLIENT_MESSAGE_TYPES.JOIN_ROOM, { roomCode });
    },
    leaveRoom(roomCode) {
      client.send(CLIENT_MESSAGE_TYPES.LEAVE_ROOM, { roomCode });
    },
  };
}

