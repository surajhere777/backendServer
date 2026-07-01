const WORDS = ["APPLE", "BANANA", "CHERRY", "DRAGON", "EAGLE", "FLOWER", "GUITAR", "HAMMER", "ISLAND", "JACKET", "KITTEN", "LAPTOP", "MOBILE", "ORANGE", "PENCIL", "ROCKET", "SNAKE", "TURTLE", "UMBRELLA", "VIOLIN"];

const rooms = {};

const createRoom = (roomId) => {
    rooms[roomId] = {
        players: [],
        currentDrawerIndex: -1,
        currentDrawer: null,
        word: "",
        wordHint: "",
        timer: 40,
        round: 0,
        maxRounds: 10,
        roundActive: false,
        messages: [],
        interval: null
    };
    return rooms[roomId];
};

const getRoom = (roomId) => rooms[roomId] || createRoom(roomId);

module.exports = { getRoom, rooms, WORDS };
