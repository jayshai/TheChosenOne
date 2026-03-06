const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve your index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game State
let players = {}; 
let gameStarted = false;
let currentQuestionIndex = 0;
let roundAnswers = { 0: 0, 1: 0, 2: 0 };

const questions = [
    { q: "Which planet is known as the 'Red Planet'?", o: ["Venus", "Mars", "Saturn"], c: 1 },
    { q: "What is the square root of 144?", o: ["12", "14", "16"], c: 0 },
    { q: "Which element has the chemical symbol 'O'?", o: ["Gold", "Oxygen", "Iron"], c: 1 },
    { q: "Who painted the Mona Lisa?", o: ["Picasso", "Van Gogh", "Da Vinci"], c: 2 },
    { q: "What is the largest ocean on Earth?", o: ["Atlantic", "Indian", "Pacific"], c: 2 }
];

io.on('connection', (socket) => {
    // First connection is Chosen One, others are Mob
    const role = Object.keys(players).length === 0 ? 'chosen' : 'mob';
    players[socket.id] = { id: socket.id, role: role, lastAnswer: null };
    
    socket.emit('init', { role });
    io.emit('updateMob', Object.keys(players).length);

    socket.on('startGame', () => {
        if (players[socket.id].role === 'chosen' && !gameStarted) {
            gameStarted = true;
            io.emit('gameStart');
            runGameLoop();
        }
    });

    socket.on('submitAnswer', (index) => {
        if (players[socket.id]) {
            players[socket.id].lastAnswer = index;
            // Track mob distribution for the heatmap
            if (players[socket.id].role === 'mob') {
                roundAnswers[index]++;
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updateMob', Object.keys(players).length);
    });
});

async function