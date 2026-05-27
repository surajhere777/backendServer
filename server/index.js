const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

// Initialize socket logic
socketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});