const { getRoom, WORDS } = require('./rooms');

module.exports = (io) => {
    const startNextRound = (roomId) => {
        const room = getRoom(roomId);
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
        
        const choices = [];
        for(let i=0; i<3; i++) {
            choices.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        }
        
        io.to(roomId).emit("room-update", room);
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
                startNextRound(roomId);
            }
        }, 1000);
    };

    io.on("connection", (socket) => {
        socket.on("join-room", ({ roomId, name }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = name;

            const room = getRoom(roomId);
            const existingPlayer = room.players.find(p => p.name === name);
            if (existingPlayer) {
                existingPlayer.id = socket.id;
            } else {
                room.players.push({ id: socket.id, name, score: 0 });
            }

            io.to(roomId).emit("room-update", room);

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
                io.to(roomId).emit("clear-canvas");
                io.to(roomId).emit("room-update", room);
                runTimer(roomId);
            }
        });

        socket.on("draw", (data) => {
            socket.to(data.roomId).emit("draw", data.stroke);
        });

        socket.on("send-guess", ({ roomId, message }) => {
            const room = getRoom(roomId);
            if (!room || !room.roundActive) return;

            const isCorrect = message.toUpperCase().trim() === room.word;
            const msgData = {
                userName: socket.userName,
                message: isCorrect ? "Guessed the word! 🎉" : message,
                isCorrect,
                isSystem: isCorrect
            };

            if (isCorrect) {
                const player = room.players.find(p => p.id === socket.id);
                if (player) player.score += (room.timer * 2);
                room.roundActive = false;
            }

            room.messages.push(msgData);
            io.to(roomId).emit("new-message", msgData);
            io.to(roomId).emit("room-update", room);
        });

        socket.on("disconnect", () => {
            if (socket.roomId) {
                const room = getRoom(socket.roomId);
                io.to(socket.roomId).emit("room-update", room);
            }
        });
    });
};
