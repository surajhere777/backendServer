const { getRoom, WORDS } = require('./rooms');

module.exports = (io) => {
    // Helper to send room data WITHOUT the timer object to prevent crashes
    const emitSafeRoomUpdate = (roomId) => {
        const room = getRoom(roomId);
        const { interval, ...safeRoomData } = room; 
        io.to(roomId).emit("room-update", safeRoomData);
    };

    const startNextRound = (roomId) => {
        const room = getRoom(roomId);
        io.to(roomId).emit("clear-canvas"); // Clear drawing for everyone

        if (room.round >= room.maxRounds) {
            io.to(roomId).emit("game-over", room.players.sort((a, b) => b.score - a.score));
            return;
        }

        room.round++;
        room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
        room.currentDrawer = room.players[room.currentDrawerIndex].id;
        
        room.roundActive = false; // Waiting for drawer to pick word
        room.firstGuessMade = false; 
        room.word = "";
        room.wordHint = "Choosing a word...";
        room.players.forEach(p => p.hasGuessed = false); 

        const choices = [
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)]
        ];
        
        emitSafeRoomUpdate(roomId);
        io.to(room.currentDrawer).emit("show-word-choices", choices);
    };

    const runTimer = (roomId) => {
        const room = getRoom(roomId);
        if (room.interval) clearInterval(room.interval);
        room.timer = 40;

        room.interval = setInterval(() => {
            if (room.timer > 0 && room.roundActive) {
                room.timer--;
                emitSafeRoomUpdate(roomId);
            } else {
                clearInterval(room.interval);
                room.roundActive = false;
                
                // Show intermediate leaderboard for 3 seconds
                io.to(roomId).emit("show-inter-round-results", true);
                emitSafeRoomUpdate(roomId);

                setTimeout(() => {
                    io.to(roomId).emit("show-inter-round-results", false);
                    startNextRound(roomId);
                }, 3000);
            }
        }, 1000);
    };

    io.on("connection", (socket) => {
        socket.on("join-room", ({ roomId, name }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = name;
            const room = getRoom(roomId);
            if (!room.players.find(p => p.name === name)) {
                room.players.push({ id: socket.id, name, score: 0, hasGuessed: false });
            }
            emitSafeRoomUpdate(roomId);
            if (room.players.length === 3 && room.round === 0) startNextRound(roomId);
        });

        socket.on("word-selected", ({ roomId, word }) => {
            const room = getRoom(roomId);
            if (room) {
                room.word = word.toUpperCase();
                room.wordHint = word.replace(/[a-zA-Z]/g, "_ ");
                room.roundActive = true;
                emitSafeRoomUpdate(roomId);
                runTimer(roomId);
            }
        });

        socket.on("send-guess", ({ roomId, message }) => {
            const room = getRoom(roomId);
            if (!room || !room.roundActive) return;
            const player = room.players.find(p => p.id === socket.id);
            if (!player || player.hasGuessed || socket.id === room.currentDrawer) return;

            if (message.toUpperCase().trim() === room.word) {
                player.hasGuessed = true;
                // SCORING: 100 for 1st, 50 for others
                const points = !room.firstGuessMade ? 100 : 50;
                player.score += points;
                room.firstGuessMade = true;

                io.to(roomId).emit("new-message", { 
                    userName: "System", 
                    message: `${socket.userName} guessed it! (+${points})`, 
                    isCorrect: true,
                    isSystem: true 
                });
                
                // If everyone (except drawer) guessed, end round early
                const guessers = room.players.filter(p => p.id !== room.currentDrawer);
                if (guessers.every(p => p.hasGuessed)) {
                    room.timer = 0; 
                }
            } else {
                io.to(roomId).emit("new-message", { userName: socket.userName, message, isCorrect: false });
            }
            emitSafeRoomUpdate(roomId);
        });

        socket.on("draw", (data) => socket.to(data.roomId).emit("draw", data.stroke));
    });
};
