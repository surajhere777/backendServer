const WORDS = ["Apple", "Banana", "Carrot", "Dolphin", "Elephant", "Fire", "Guitar", "House", "Island", "Jungle"];

const rooms = {};

const createRoom = (roomId) => {
    rooms[roomId] = {
        players: [],
        currentDrawer: null,
        word: "",
        wordHint: "",
        timer: 60,
        roundActive: false,
        messages: [],
        interval: null
    };
    return rooms[roomId];
};

const getRoom = (roomId) => rooms[roomId] || createRoom(roomId);

const selectNewDrawer = (room) => {
    if (room.players.length === 0) return null;
    const currentIndex = room.players.findIndex(p => p.id === room.currentDrawer);
    const nextIndex = (currentIndex + 1) % room.players.length;
    room.currentDrawer = room.players[nextIndex].id;
    return room.currentDrawer;
};

const startTimer = (roomId, io) => {
    const room = rooms[roomId];
    if (room.interval) clearInterval(room.interval);

    room.interval = setInterval(() => {
        if (room.timer > 0 && room.roundActive) {
            room.timer--;
            io.to(roomId).emit("room-update", room);
        } else {
            clearInterval(room.interval);
            room.roundActive = false;
            // Logic to start next round or end game can go here
            io.to(roomId).emit("room-update", room);
        }
    }, 1000);
};

module.exports = { getRoom, rooms, selectNewDrawer, startTimer, WORDS };
