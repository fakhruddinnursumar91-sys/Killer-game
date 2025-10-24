const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = [];
let roles = {};
let alive = {};
let gameStarted = false;

// Send updated player list to all
function emitPlayers() {
  io.emit("updatePlayers", players, alive);
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Add player
  socket.on("addPlayer", (name) => {
    if (!gameStarted && name && !players.includes(name)) {
      players.push(name);
      alive[name] = true;
      emitPlayers();
      console.log("Player added:", name);
    }
  });

  // Start game
  socket.on("startGame", () => {
    if (!gameStarted && players.length >= 2) {
      gameStarted = true;
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      roles = {};
      roles[shuffled[0]] = "Killer";
      shuffled.slice(1).forEach(p => roles[p] = "Crewmate");
      io.emit("gameStarted", roles);
      console.log("Game started", roles);
    }
  });

  // End game
  socket.on("endGame", () => {
    gameStarted = false;
    players = [];
    roles = {};
    alive = {};
    io.emit("gameEnded");
    console.log("Game ended");
  });

  // Mark player dead
  socket.on("markDead", (name) => {
    if (alive[name] && roles[name] !== "Killer") {
      alive[name] = false;
      io.emit("playerDied", name);
      emitPlayers();
      console.log("Player dead:", name);
    }
  });

  // Send current players when client connects
  socket.emit("updatePlayers", players, alive);

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));