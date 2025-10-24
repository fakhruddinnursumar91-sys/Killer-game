const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = []; // all players
let roles = {};   // roles assigned
let alive = {};   // alive status
let gameStarted = false;

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("addPlayer", (name) => {
    if (!gameStarted && !players.includes(name)) {
      players.push(name);
      alive[name] = true;
      io.emit("playerAdded", name);
      console.log("Player added:", name);
    }
  });

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

  socket.on("endGame", () => {
    gameStarted = false;
    players = [];
    roles = {};
    alive = {};
    io.emit("gameEnded");
    console.log("Game ended");
  });

  socket.on("markDead", (playerName) => {
    if (alive[playerName] && roles[playerName] !== "Killer") {
      alive[playerName] = false;
      io.emit("playerDied", playerName);
      console.log("Player dead:", playerName);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));