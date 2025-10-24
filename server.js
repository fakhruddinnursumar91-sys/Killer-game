const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = []; // {name, id, alive, role}
let gameStarted = false;

// Utility to shuffle array
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Assign roles to all players
function assignRoles() {
  if (players.length < 2) return;
  const shuffled = shuffle([...players]);
  shuffled[0].role = "Killer";
  shuffled.slice(1).forEach(p => p.role = "Crewmate");
  players.forEach(p => p.alive = true);
}

// Reset game (alive and shuffle roles)
function resetGame() {
  players.forEach(p => p.alive = true);
  assignRoles();
}

// Emit current state to all players
function updatePlayers() {
  io.emit('updatePlayers', players.map(p => ({
    name: p.name,
    alive: p.alive
  })));
}

// Emit role to specific player
function sendRole(socket) {
  const player = players.find(p => p.id === socket.id);
  if (player) {
    socket.emit('yourRole', player.role);
  }
}

// Socket.io connections
io.on('connection', socket => {

  // New player joins
  socket.on('newPlayer', name => {
    // Check if already exists
    let existing = players.find(p => p.name === name);
    if (!existing) {
      players.push({name, id: socket.id, alive: true, role: null});
    } else {
      existing.id = socket.id; // reconnect
    }

    // If game already started, assign role to this player
    if (gameStarted) sendRole(socket);

    updatePlayers();
  });

  // Host starts the game
  socket.on('startGame', () => {
    gameStarted = true;
    assignRoles();
    // Send role to each player
    players.forEach(p => {
      io.to(p.id).emit('yourRole', p.role);
    });
    updatePlayers();
  });

  // Host ends game
  socket.on('endGame', () => {
    gameStarted = false;
    resetGame();
    // Send roles again
    players.forEach(p => io.to(p.id).emit('yourRole', p.role));
    updatePlayers();
  });

  // Player marks dead
  socket.on('toggleDead', () => {
    const player = players.find(p => p.id === socket.id);
    if (!player || player.role === "Killer") return; // Killer cannot mark dead
    player.alive = !player.alive;
    updatePlayers();
    io.emit('playerDeadMessage', player.name);
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Keep player data to allow reconnect
    updatePlayers();
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));