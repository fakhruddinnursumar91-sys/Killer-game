const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = []; // {name, id, alive, role}
let gameStarted = false;

// Shuffle helper
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Assign roles
function assignRoles() {
  if (players.length < 2) return;
  const shuffled = shuffle([...players]);
  shuffled[0].role = "Killer";
  shuffled.slice(1).forEach(p => p.role = "Crewmate");
  players.forEach(p => p.alive = true);
}

// Reset game
function resetGame() {
  players.forEach(p => p.alive = true);
  assignRoles();
}

// Send updated player list to all
function updatePlayers() {
  io.emit('updatePlayers', players.map(p => ({
    name: p.name,
    alive: p.alive
  })));
}

// Send role to a player
function sendRole(socket) {
  const player = players.find(p => p.id === socket.id);
  if (player) socket.emit('yourRole', player.role);
}

io.on('connection', socket => {

  // New player joins
  socket.on('newPlayer', name => {
    let existing = players.find(p => p.name === name);
    if (!existing) {
      players.push({name, id: socket.id, alive: true, role: null});
    } else {
      existing.id = socket.id; // reconnect
    }

    if (gameStarted) sendRole(socket);
    updatePlayers();
  });

  // Host starts game
  socket.on('startGame', () => {
    gameStarted = true;
    assignRoles();
    players.forEach(p => io.to(p.id).emit('yourRole', p.role));
    updatePlayers();
  });

  // Host ends game
  socket.on('endGame', () => {
    gameStarted = false;
    resetGame();
    players.forEach(p => io.to(p.id).emit('yourRole', p.role));
    updatePlayers();
  });

  // Player toggles dead/alive
  socket.on('toggleDead', () => {
    const player = players.find(p => p.id === socket.id);
    if (!player || player.role === "Killer") return;
    player.alive = !player.alive;
    updatePlayers();
    io.emit('playerDeadMessage', player.name);
  });

  socket.on('disconnect', () => {
    updatePlayers(); // keep player data for reconnect
  });

});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));