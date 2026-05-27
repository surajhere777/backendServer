const rooms = require("./rooms");

module.exports = function (io) {
  console.log("✅ socket.js loaded (exporting function)");

  io.on("connection", (socket) => {
    console.log("🟢 Player connected:", socket.id);

    // JOIN ROOM
    socket.on("join-room", ({ roomId, name }) => {
      socket.join(roomId);
      rooms.addPlayer(roomId, socket.id, name);

      const room = rooms.getRoom(roomId);

      // start game if first player
      if (room.players.length === 1) {
        rooms.startRound(roomId);
      }

      // send room update to all players
      io.to(roomId).emit("room-update", {
        players: room.players,
        drawerIndex: room.drawerIndex,
      });

      // send secret word ONLY to drawer
      if (room && room.players.length > 0) {
        const drawer = room.players[room.drawerIndex];
        if (drawer) {
          io.to(drawer.socketId).emit("word", room.word);
        }
      }
    });

    // DRAW EVENT
    socket.on("draw", ({ roomId, stroke }) => {
      socket.to(roomId).emit("draw", stroke);
    });

    // GUESS EVENT
    socket.on("guess", ({ roomId, message, name }) => {
      const room = rooms.getRoom(roomId);
      if (!room) return;

      if (message.toLowerCase() === room.word) {
        const player = room.players.find(
          (p) => p.name === name
        );
        if (player) player.score += 10;

        rooms.nextTurn(roomId);

        io.to(roomId).emit("correct-guess", {
          name,
          word: room.word,
        });

        const updatedRoom = rooms.getRoom(roomId);

        io.to(roomId).emit("room-update", {
          players: updatedRoom.players,
          drawerIndex: updatedRoom.drawerIndex,
        });

        if (updatedRoom && updatedRoom.players.length > 0) {
          const drawer =
            updatedRoom.players[updatedRoom.drawerIndex];
          if (drawer) {
            io.to(drawer.socketId).emit("word", updatedRoom.word);
          }
        }
      } else {
        io.to(roomId).emit("guess", { name, message });
      }
    });

    socket.on("disconnect", () => {
      rooms.removePlayer(socket.id);
      console.log("🔴 Player disconnected:", socket.id);
    });
  });
};
