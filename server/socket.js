const { getRoom, WORDS } = require('./rooms');

module.exports = (io) => {
    const startNextRound = (roomId) => {
        const room = getRoom(roomId);
        io.to(roomId).emit("clear-canvas"); // Clear canvas for new round

        if (room.round >= room.maxRounds) {
            io.to(roomId).emit("game-over", room.players.sort((a, b) => b.score - a.score));
            return;
        }

        room.round++;
        room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
        room.currentDrawer = room.players[room.currentDrawerIndex].id;
        
        room.roundActive = false;
        room.firstGuessMade = false; // Track for 100 vs 50 points
        room.word = "";
        room.wordHint = "Choosing a word...";
        
        const choices = [
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)],
            WORDS[Math.floor(Math.random() * WORDS.length)]
        ];
        
        io.to(roomId).emit("room-update", room);
        io.to(room.currentDrawer).emit("show-word-choices", choices);
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
                // Show leaderboard for 3 seconds before next round
                io.to(roomId).emit("show-inter-round-leaderboard", true);
                setTimeout(() => {
                    io.to(roomId).emit("show-inter-round-leaderboard", false);
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
            io.to(roomId).emit("room-update", room);
            if (room.players.length === 3 && room.round === 0) startNextRound(roomId);
        });

        socket.on("word-selected", ({ roomId, word }) => {
            const room = getRoom(roomId);
            if (room) {
                room.word = word.toUpperCase();
                room.wordHint = word.replace(/[a-zA-Z]/g, "_ ");
                room.roundActive = true;
                room.timer = 40;
                room.players.forEach(p => p.hasGuessed = false); // Reset guessing status
                io.to(roomId).emit("room-update", room);
                runTimer(roomId);
            }
        });

        socket.on("send-guess", ({ roomId, message }) => {
            const room = getRoom(roomId);
            if (!room || !room.roundActive) return;
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.hasGuessed) return; // Prevent double scoring

            const isCorrect = message.toUpperCase().trim() === room.word;
            if (isCorrect) {
                player.hasGuessed = true;
                if (!room.firstGuessMade) {
                    player.score += 100; // 100 for first
                    room.firstGuessMade = true;
                } else {
                    player.score += 50; // 50 for others
                }
                io.to(roomId).emit("new-message", { userName: "System", message: `${socket.userName} guessed it!`, isCorrect: true });
                
                // If all guessers got it, end round early
                const allGuessed = room.players.filter(p => p.id !== room.currentDrawer).every(p => p.hasGuessed);
                if (allGuessed) room.timer = 0; 
            } else {
                io.to(roomId).emit("new-message", { userName: socket.userName, message, isCorrect: false });
            }
            io.to(roomId).emit("room-update", room);
        });

        socket.on("draw", (data) => socket.to(data.roomId).emit("draw", data.stroke));
    });
};
