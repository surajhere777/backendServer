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
app.get('/version-check', (req, res) => {
    res.json({
        latestVersion: "1.0.1", // This MUST match the version in your pubspec.yaml
        downloadUrl: "https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO/releases/download/v1.0.1/app-release.apk",
        releaseNotes: "🔥 Fixed canvas flickering and keyboard issues! Drawing is now smooth."
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
