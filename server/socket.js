const { getRoom, selectNewDrawer, WORDS } = require('./rooms');

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("Connected:", socket.id);

        socket.on("join-room", ({ roomId, name }) => {
            if (!roomId || !name) {
                console.error("join-room event missing roomId or name", { roomId, name });
                return;
            }

            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = name;

            const room = getRoom(roomId);
            if (!room) {
                console.error("Could not retrieve or create room", roomId);
                return;
            }
            room.players = room.players || [];
            room.messages = room.messages || [];
            room.currentDrawer = room.currentDrawer || null;

            // RECONNECTION LOGIC: Find player by name instead of ID
            const existingPlayer = room.players.find(p => p.name === name);
            
            if (existingPlayer) {
                const oldId = existingPlayer.id;
                existingPlayer.id = socket.id; // Update to new Socket ID
                
                // If the reconnected player was the drawer, update the room's drawer ID
                if (room.currentDrawer === oldId) {
                    room.currentDrawer = socket.id;
                }
                console.log(`Reconnected player: ${name}`);
            } else {
                room.players.push({ id: socket.id, name, score: 0 });
            }

            // Sync room state with everyone immediately
            io.to(roomId).emit("room-update", room);

            // If game is ready but no drawer is assigned
            if (room.players.length >= 2 && !room.currentDrawer) {
                const drawerId = selectNewDrawer(room);
                io.to(roomId).emit("room-update", room);

                const choices = [
                    WORDS[Math.floor(Math.random() * WORDS.length)],
                    WORDS[Math.floor(Math.random() * WORDS.length)],
                    WORDS[Math.floor(Math.random() * WORDS.length)]
                ];
                io.to(drawerId).emit("show-word-choices", choices);
            } 
            // If reconnected player IS the drawer and hasn't picked a word yet, resend choices
            else if (room.currentDrawer === socket.id && !room.roundActive) {
                const choices = [WORDS[0], WORDS[1], WORDS[2]];
                socket.emit("show-word-choices", choices);
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
                
                if (room.interval) clearInterval(room.interval);
                room.interval = setInterval(() => {
                    if (room.timer > 0 && room.roundActive) {
                        room.timer--;
                        io.to(roomId).emit("room-update", room);
                    } else {
                        clearInterval(room.interval);
                        room.roundActive = false;
                        room.currentDrawer = null; // Prepare for next round
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
                room.roundActive = false; // End round on success
            }

            room.messages.push(msgData);
            io.to(roomId).emit("new-message", msgData);
            io.to(roomId).emit("room-update", room);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected:", socket.id);
            // We don't remove players immediately to allow for reconnection
            // They are filtered out if the room becomes empty or after a timeout
        });
    });
};