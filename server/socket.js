const { getRoom, WORDS } = require('./rooms');

module.exports = (io) => {
    const startNextRound = (roomId) => {
        const room = getRoom(roomId);
        
        // Reset canvas for everyone
        io.to(roomId).emit("clear-canvas");

        if (room.round >= room.maxRounds) {
            io.to(roomId).emit("game-over", room.players.sort((a, b) => b.score - a.score));
            return;
        }

        room.round++;
        room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
        const drawerId = room.players[room.currentDrawerIndex].id;
        room.currentDrawer = drawerId;
        
        room.roundActive = false;
        room.word = "";
        room.wordHint = "Choosing a word...";
        
        const choices = [
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)]
        ];
        
        // Tell everyone who is drawing and what the round is
        io.to(roomId).emit("room-update", room);
        // Send choices to the drawer
        io.to(drawerId).emit("show-word-choices", choices);
    };

    const runTimer = (roomId) => {
        const room = getRoom(roomId);
        if (room.interval) clearInterval(room.interval);

        room.interval = setInterval(() => {
            if (room.timer > 0 && room.roundActive) {
                room.timer--;
                io.to(roomId).emit("room-update", room);
            } else {
                clearInterval(room.interval);
                room.roundActive = false;
                // Wait 3 seconds before next round so players can see scores
                setTimeout(() => startNextRound(roomId), 3000);
            }
        }, 1000);
    };

    io.on("connection", (socket) => {
        socket.on("join-room", ({ roomId, name }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = name;

            const room = getRoom(roomId);
            const existing = room.players.find(p => p.name === name);
            if (existing) {
                existing.id = socket.id;
            } else {
                room.players.push({ id: socket.id, name, score: 0 });
            }

            io.to(roomId).emit("room-update", room);

            // Start game if 3 players are present
            if (room.players.length === 3 && room.round === 0) {
                startNextRound(roomId);
            }
        });

        socket.on("word-selected", ({ roomId, word }) => {
            const room = getRoom(roomId);
            if (room) {
                room.word = word.toUpperCase();
                room.wordHint = word.replace(/[a-zA-Z]/g, "_ ");
                room.roundActive = true;
                room.timer = 40;
                io.to(roomId).emit("room-update", room);
                runTimer(roomId);
            }
        });

        socket.on("send-guess", ({ roomId, message }) => {
            const room = getRoom(roomId);
            if (!room || !room.roundActive) return;

            const isCorrect = message.toUpperCase().trim() === room.word;
            if (isCorrect) {
                const player = room.players.find(p => p.id === socket.id);
                if (player) player.score += (room.timer * 2);
                
                io.to(roomId).emit("new-message", {
                    userName: "System",
                    message: `${socket.userName} guessed correctly! 🎉`,
                    isCorrect: true,
                    isSystem: true
                });
                
                // End round early and show points
                room.roundActive = false;
                io.to(roomId).emit("room-update", room);
            } else {
                io.to(roomId).emit("new-message", {
                    userName: socket.userName,
                    message: message,
                    isCorrect: false,
                    isSystem: false
                });
            }
        });

        socket.on("draw", (data) => {
            socket.to(data.roomId).emit("draw", data.stroke);
        });

        socket.on("disconnect", () => {
            // Optional: Handle player leaving
        });
    });
};
