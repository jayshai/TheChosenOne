// Ensure Socket.io client library is loaded in your <head>
const socket = io(); 
let myRole = 'mob';
let selected = null;
let currentQIndex = 0;
let isLocked = true;

// Initialize the grid visually (Keeping your original loop)
const grid = document.getElementById('mob-grid');
for(let i=0; i<100; i++) grid.innerHTML += `<div class="mob-tile" id="m-${i}">👤</div>`;

// Initialize ladder (Keeping your original loop)
const prizes = ["$1k", "$5k", "$10k", "$25k", "$50k", "$100k", "$250k", "$500k", "$1M"];
const ladder = document.getElementById('ladder');
prizes.forEach((p, i) => ladder.innerHTML += `<div class="step" id="s-${i}">${p}</div>`);

// --- MULTIPLAYER LISTENERS ---

// Assign Role on Connection
socket.on('init', (data) => {
    myRole = data.role;
    // Update your existing user profile UI
    document.querySelector('.user-avatar').innerText = (myRole === 'chosen' ? 'C1' : 'M');
    document.querySelector('.user-profile div:nth-child(2)').innerText = (myRole === 'chosen' ? 'CHOSEN_ONE' : 'THE_MOB');
    
    const btn = document.getElementById('enter-arena-btn');
    if(myRole === 'chosen') {
        btn.innerText = "START THE ARENA";
    } else {
        btn.innerText = "WAITING FOR HOST";
        btn.style.pointerEvents = "none"; // Mob cannot trigger start
    }
});

// Update Real-Time Player Count
socket.on('updateMob', (count) => {
    document.getElementById('lobby-count').childNodes[0].textContent = count + " ";
    document.getElementById('mob-count').innerText = count;
    
    if(count >= 1) {
        const btn = document.getElementById('enter-arena-btn');
        btn.disabled = false;
        btn.style.opacity = "1";
    }
});

// Sync Game Transitions
socket.on('gameStart', () => {
    document.getElementById('lobby-overlay').style.display = 'none';
});

// Load Question from Server
socket.on('nextQuestion', (data) => {
    selected = null;
    isLocked = false;
    document.getElementById('q-text').innerText = data.q;
    document.getElementById('heatmap').style.opacity = 0;
    document.getElementById('shroud').style.opacity = 0;
    document.getElementById('action-bar-inner').classList.remove('active');
    
    const opts = document.querySelectorAll('.btn-opt');
    opts.forEach((btn, i) => {
        btn.innerText = `${String.fromCharCode(65+i)}. ${data.o[i]}`;
        btn.classList.remove('locked', 'reveal-correct', 'reveal-wrong');
        btn.disabled = false;
    });
    
    // Clear the visual 'voted' state from tiles
    document.querySelectorAll('.mob-tile').forEach(t => t.classList.remove('voted'));
});

// Synchronized Server Timer
socket.on('tick', (count) => {
    document.getElementById('timer-text').innerText = count;
    // Update your existing SVG progress circle
    document.getElementById('timer-path').style.strokeDashoffset = 283 - (283 * (count / 15));
});

// Real-Time Mob Activity Feedback
socket.on('mobVoted', () => {
    const available = document.querySelectorAll('.mob-tile:not(.voted):not(.eliminated)');
    if(available.length > 0) {
        available[Math.floor(Math.random() * available.length)].classList.add('voted');
    }
});

// Final Reveal Logic
socket.on('reveal', (data) => {
    isLocked = true;
    const opts = document.querySelectorAll('.btn-opt');
    opts.forEach((btn, i) => {
        btn.disabled = true;
        if(i === data.correct) btn.classList.add('reveal-correct');
        else if(i === selected) btn.classList.add('reveal-wrong');
    });

    // Populate your existing Heatmap with real data
    document.getElementById('heatmap').style.opacity = 1;
    [0,1,2].forEach(i => {
        const bar = document.getElementById(`bar-${i}`);
        bar.style.height = (data.stats[i] || 5) + "%";
        bar.className = 'heat-bar ' + (i === data.correct ? 'correct' : 'incorrect');
    });

    // Update Prize Ladder progress
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    if(document.getElementById(`s-${currentQIndex}`)) {
        document.getElementById(`s-${currentQIndex}`).classList.add('active');
    }
    currentQIndex++;
});

// Handle Game Over
socket.on('gameOver', (data) => {
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('overlay').style.opacity = '1';
    document.getElementById('res-msg').innerText = data.message;
});

// --- CLIENT ACTIONS ---

function readyUp() {
    if(myRole === 'chosen') socket.emit('startGame');
}

function userSelect(i) {
    if(isLocked || selected !== null) return;
    selected = i;
    document.querySelectorAll('.btn-opt').forEach((btn, idx) => {
        btn.classList.toggle('locked', idx === i);
    });
    // Send choice to server to calculate heatmap
    socket.emit('submitAnswer', i);
}
