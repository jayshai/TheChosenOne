const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

// Helper to reassign Master if needed
function reassignMaster() {
    const ids = Object.keys(players);
    if (ids.length > 0) {
        const hasChosen = ids.some(id => players[id].role === 'chosen');
        if (!hasChosen) {
            players[ids[0]].role = 'chosen';
            io.to(ids[0]).emit('init', { role: 'chosen' });
        }
    }
}

io.on('connection', (socket) => {
    const role = Object.keys(players).length === 0 ? 'chosen' : 'mob';
    players[socket.id] = { id: socket.id, role: role, lastAnswer: null };
    
    socket.emit('init', { role });
    io.emit('updateMob', Object.keys(players).length);

    socket.on('startGame', () => {
        if (players[socket.id]?.role === 'chosen' && !gameStarted) {
            gameStarted = true;
            io.emit('gameStart');
            runGameLoop();
        }
    });

    socket.on('submitAnswer', (index) => {
        if (players[socket.id]) {
            players[socket.id].lastAnswer = index;
            if (players[socket.id].role === 'mob') {
                roundAnswers[index]++;
                // Trigger animation for everyone else
                io.emit('mobVoted');
            }
        }
    });

    socket.on('playOn', () => {
        if (players[socket.id]?.role === 'chosen') {
            currentQuestionIndex++;
            runGameLoop();
        }
    });

    socket.on('walkAway', () => {
        if (players[socket.id]?.role === 'chosen') {
            io.emit('gameOver', { message: "THE CHOSEN ONE TOOK THE MONEY AND FLED!" });
            gameStarted = false;
            currentQuestionIndex = 0;
        }
    });

    socket.on('disconnect', () => {
        const wasChosen = players[socket.id]?.role === 'chosen';
        delete players[socket.id];
        if (wasChosen) reassignMaster();
        io.emit('updateMob', Object.keys(players).length);
    });
});

async function runGameLoop() {
    if (currentQuestionIndex >= questions.length) {
        io.emit('gameOver', { message: "ARENA CONCLUDED: NO QUESTIONS REMAINING" });
        return;
    }
    roundAnswers = { 0: 0, 1: 0, 2: 0 };
    const q = questions[currentQuestionIndex];
    io.emit('nextQuestion', { q: q.q, o: q.o });
    
    let timeLeft = 15;
    const timer = setInterval(() => {
        timeLeft--;
        io.emit('tick', timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timer);
            resolveRound();
        }
    }, 1000);
}

function resolveRound() {
    const q = questions[currentQuestionIndex];
    const chosenOneId = Object.keys(players).find(id => players[id].role === 'chosen');
    const chosenOne = players[chosenOneId];
    
    const mobTotal = Object.values(players).filter(p => p.role === 'mob').length || 1;
    const stats = {
        0: Math.round((roundAnswers[0] / mobTotal) * 100),
        1: Math.round((roundAnswers[1] / mobTotal) * 100),
        2: Math.round((roundAnswers[2] / mobTotal) * 100)
    };

    io.emit('reveal', { correct: q.c, stats: stats });

    if (!chosenOne || chosenOne.lastAnswer !== q.c) {
        setTimeout(() => {
            io.emit('gameOver', { message: "THE CHOSEN ONE WAS ELIMINATED BY THE MOB!" });
            gameStarted = false;
            currentQuestionIndex = 0; 
        }, 2000);
        return;
    }

    setTimeout(() => {
        io.emit('decisionPhase');
    }, 3000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena live`));
