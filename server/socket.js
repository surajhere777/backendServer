const { getRoom, selectNewDrawer, WORDS } = require('./rooms');

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("Connected:", socket.id);

        socket.on("join-room", ({ roomId, name }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = name;

            const room = getRoom(roomId);
            // Avoid duplicate players if they reconnect
            if (!room.players.find(p => p.id === socket.id)) {
                room.players.push({ id: socket.id, name, score: 0 });
            }

            // Tell everyone a new player joined
            io.to(roomId).emit("room-update", room);

            // If 2 players are here and no game is active, start a round
            if (room.players.length >= 2 && !room.currentDrawer) {
                const drawerId = selectNewDrawer(room);
                
                // IMPORTANT: Tell everyone who the drawer is NOW
                io.to(roomId).emit("room-update", room);

                // Send word choices ONLY to the drawer
                const choices = [
                    WORDS[Math.floor(Math.random() * WORDS.length)],
                    WORDS[Math.floor(Math.random() * WORDS.length)],
                    WORDS[Math.floor(Math.random() * WORDS.length)]
                ];
                io.to(drawerId).emit("show-word-choices", choices);
            }
        });

        socket.on("word-selected", ({ roomId, word }) => {
            const room = getRoom(roomId);
            if (room) {
                room.word = word.toLowerCase();
                room.wordHint = word.replace(/[a-zA-Z]/g, "_ ");
                room.roundActive = true;
                room.timer = 60;

                io.to(roomId).emit("clear-canvas");
                io.to(roomId).emit("room-update", room);
                
                // Start the countdown
                if (room.interval) clearInterval(room.interval);
                room.interval = setInterval(() => {
                    if (room.timer > 0 && room.roundActive) {
                        room.timer--;
                        io.to(roomId).emit("room-update", room);
                    } else {
                        clearInterval(room.interval);
                        room.roundActive = false;
                        // Logic to pick next drawer can go here
                        io.to(roomId).emit("room-update", room);
                    }
                }, 1000);
            }
        });

        socket.on("draw", (data) => {
            socket.to(data.roomId).emit("draw", data.stroke);
        });

        socket.on("send-guess", ({ roomId, message }) => {
            const room = getRoom(roomId);
            if (!room || !room.roundActive) return;

            const isCorrect = message.toLowerCase().trim() === room.word;
            const msgData = {
                userName: socket.userName,
                message: isCorrect ? "Guessed the word! 🎉" : message,
                isCorrect,
                isSystem: isCorrect
            };

            if (isCorrect) {
                const player = room.players.find(p => p.id === socket.id);
                if (player) player.score += 100;
                // Optional: End round if guessed
            }

            room.messages.push(msgData);
            io.to(roomId).emit("new-message", msgData);
            io.to(roomId).emit("room-update", room);
        });

        socket.on("disconnect", () => {
            if (socket.roomId) {
                const room = getRoom(socket.roomId);
                room.players = room.players.filter(p => p.id !== socket.id);
                if (room.players.length === 0) {
                    if (room.interval) clearInterval(room.interval);
                }
                io.to(socket.roomId).emit("room-update", room);
            }
        });
    });
};