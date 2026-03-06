const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; 

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ room, username, avatar }) => {
        socket.join(room);
        socket.username = username;
        socket.avatar = avatar;
        socket.room = room;

        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                status: 'lobby',
                currentQuestion: 0,
                chosenOne: null
            };
        }

        const roomData = rooms[room];
        roomData.players.push(socket.id);

        // Role Logic: First is Chosen One, others are Mob
        let role = 'mob';
        if (!roomData.chosenOne) {
            roomData.chosenOne = socket.id;
            role = 'chosen';
        } else if (roomData.status === 'playing') {
            role = 'spectator';
        }

        socket.role = role;
        socket.emit('init', { role, room, username });
        io.to(room).emit('updateMob', roomData.players.length);
    });

    socket.on('startGame', () => {
        if (socket.role === 'chosen') {
            rooms[socket.room].status = 'playing';
            io.to(socket.room).emit('gameStart');
            // Trigger first question logic here
        }
    });

    socket.on('disconnect', () => {
        if (rooms[socket.room]) {
            rooms[socket.room].players = rooms[socket.room].players.filter(id => id !== socket.id);
            io.to(socket.room).emit('updateMob', rooms[socket.room].players.length);
        }
    });
});

server.listen(3000, () => console.log('Arena live on port 3000'));
