const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS allowed for your Render domain
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; 
const questions = [
    { q: "Which planet is known as the Red Planet?", o: ["Mars", "Venus", "Jupiter"], c: 0 },
    { q: "What is the capital of France?", o: ["Berlin", "Madrid", "Paris"], c: 2 },
    { q: "Which element has the chemical symbol 'O'?", o: ["Gold", "Oxygen", "Iron"], c: 1 },
    { q: "How many continents are there?", o: ["5", "6", "7"], c: 2 }
];

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ room, name, avatar }) => {
        socket.join(room);
        socket.roomCode = room;
        socket.userName = name;
        
        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                status: 'lobby',
                currentQIndex: 0,
                chosenOne: null,
                mobAnswers: {}
            };
        }

        const roomData = rooms[room];
        roomData.players.push(socket.id);

        if (!roomData.chosenOne) {
            roomData.chosenOne = socket.id;
            socket.role = 'chosen';
        } else {
            socket.role = (roomData.status === 'playing') ? 'spectator' : 'mob';
        }

        socket.emit('init', { role: socket.role, name: socket.userName });
        io.to(room).emit('updateMob', roomData.players.length);
    });

    socket.on('startArena', () => {
        const roomData = rooms[socket.roomCode];
        if (socket.role === 'chosen' && roomData.status === 'lobby') {
            roomData.status = 'playing';
            io.to(socket.roomCode).emit('arenaStarted');
            sendNextQuestion(socket.roomCode);
        }
    });

    function sendNextQuestion(room) {
        const roomData = rooms[room];
        const q = questions[roomData.currentQIndex];
        if (!q) {
            io.to(room).emit('gameOver', { message: "The Chosen One conquered the Arena!" });
            return;
        }
        roomData.mobAnswers = {}; 
        io.to(room).emit('nextQ', { question: q.q, options: q.o });
    }

    socket.on('submitAnswer', (idx) => {
        const roomData = rooms[socket.roomCode];
        if (!roomData || roomData.status !== 'playing') return;

        if (socket.role === 'mob') {
            roomData.mobAnswers[socket.id] = idx;
            socket.to(socket.roomCode).emit('mobVoted'); 
        } else if (socket.role === 'chosen') {
            const correct = questions[roomData.currentQIndex].c;
            const totalMob = Math.max(1, roomData.players.length - 1);
            const stats = [0, 0, 0];
            Object.values(roomData.mobAnswers).forEach(ans => stats[ans]++);
            const percStats = stats.map(s => (s / totalMob) * 100);

            io.to(socket.roomCode).emit('reveal', { correct, chosen: idx, stats: percStats });

            if (idx === correct) {
                roomData.currentQIndex++;
                roomData.status = 'playing'; 
                setTimeout(() => sendNextQuestion(socket.roomCode), 4000);
            } else {
                io.to(socket.roomCode).emit('gameOver', { message: "The Mob claimed a victim!" });
            }
        }
    });

    socket.on('disconnect', () => {
        const room = socket.roomCode;
        if (rooms[room]) {
            rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
            if (socket.id === rooms[room].chosenOne) {
                io.to(room).emit('gameOver', { message: "Chosen One disconnected." });
                delete rooms[room];
            } else {
                io.to(room).emit('updateMob', rooms[room].players.length);
            }
        }
    });
});

// IMPORTANT FOR RENDER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
