const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS allowed for all origins
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Pass the io instance to your socket logic handler
socketHandler(io);

// Basic route for health check
app.get('/', (req, res) => {
    res.send('Scribble Backend is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
