const words = ["apple", "car", "tree", "house", "dog"];

const rooms = {};

/*
roomId: {
  players: [{ socketId, name, score }],
  drawerIndex: 0,
  word: "apple"
}
*/

function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: [],
      drawerIndex: 0,
      word: null,
    };
  }
}

function addPlayer(roomId, socketId, name) {
  createRoom(roomId);
  rooms[roomId].players.push({
    socketId,
    name,
    score: 0,
  });
}

function removePlayer(socketId) {
  for (const roomId in rooms) {
    rooms[roomId].players = rooms[roomId].players.filter(
      (p) => p.socketId !== socketId
    );

    if (rooms[roomId].players.length === 0) {
      delete rooms[roomId];
    }
  }
}

function startRound(roomId) {
  const room = rooms[roomId];
  room.word = words[Math.floor(Math.random() * words.length)];
}

function nextTurn(roomId) {
  const room = rooms[roomId];
  room.drawerIndex =
    (room.drawerIndex + 1) % room.players.length;
  startRound(roomId);
}

function getRoom(roomId) {
  return rooms[roomId];
}

module.exports = {
  addPlayer,
  removePlayer,
  startRound,
  nextTurn,
  getRoom,
};
