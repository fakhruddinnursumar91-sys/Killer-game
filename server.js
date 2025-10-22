const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const crypto = require("crypto");

const PORT = 3000;

app.use(express.static("public"));

let players = [];
let gameStarted = false;
let votes = {};

function assignRoles() {
  if (players.length < 2) return false;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  players.forEach((p) => (p.role = "Crewmate"));
  shuffled[0].role = "Killer";
  gameStarted = true;
  return true;
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.emit("updatePlayers", players);

  // Add player
  socket.on("addPlayer", (name) => {
    if (gameStarted) {
      socket.emit("broadcast", "Game already started!");
      return;
    }
    const token = crypto.randomBytes(4).toString("hex");
    const newPlayer = { name, token, socketId: null, alive: true, role: null };
    players.push(newPlayer);
    io.emit("updatePlayers", players);
  });

  // Player joins using token
  socket.on("joinAsPlayer", (token) => {
    const player = players.find((p) => p.token === token);
    if (!player) {
      socket.emit("broadcast", "Invalid player token!");
      return;
    }
    player.socketId = socket.id;
    socket.emit("playerInfo", player);

    if (player.role) socket.emit("roleAssigned", player.role);
  });

  // Start game
  socket.on("startGame", () => {
    if (players.length < 2) return socket.emit("broadcast", "Need at least 2 players!");
    const ok = assignRoles();
    if (!ok) return socket.emit("broadcast", "Failed to assign roles");

    io.emit("broadcast", "🎮 Game Started! Roles assigned.");
    players.forEach(p => {
      if (p.socketId) io.to(p.socketId).emit("roleAssigned", p.role);
    });
    io.emit("updatePlayers", players);
  });

  // Mark dead
  socket.on("markDead", (token) => {
    const player = players.find(p => p.token === token);
    if (!player) return socket.emit("broadcast", "Invalid token!");
    if (!player.alive) return socket.emit("broadcast", "Already dead!");
    if (player.role === "Killer") return socket.emit("broadcast", "❌ Killer cannot mark themselves dead!");

    player.alive = false;
    io.emit("broadcast", `${player.name} is dead 💀`);
    io.emit("updatePlayers", players);
  });

  // Start voting (host)
  socket.on("startVoting", () => {
    votes = {};
    io.emit("broadcast", "🗳️ Voting started! Vote for the killer.");
    const alivePlayers = players.filter(p => p.alive);
    alivePlayers.forEach(p => {
      if (p.socketId) io.to(p.socketId).emit("votingStart", alivePlayers.map(a => a.name).filter(n => n !== p.name));
    });
  });

  // Submit vote
  socket.on("vote", ({ voterToken, targetName }) => {
    const voter = players.find(p => p.token === voterToken);
    if (!voter || !voter.alive) return;
    votes[voter.name] = targetName;

    const aliveCount = players.filter(p => p.alive).length;
    if (Object.keys(votes).length === aliveCount) {
      const tally = {};
      Object.values(votes).forEach(n => tally[n] = (tally[n] || 0) + 1);
      const sorted = Object.entries(tally).sort((a,b) => b[1]-a[1]);
      const [eliminated] = sorted[0];
      const playerObj = players.find(p => p.name === eliminated);
      if (playerObj) playerObj.alive = false;

      io.emit("broadcast", `💥 ${eliminated} was eliminated. They were a ${playerObj.role}!`);
      io.emit("updatePlayers", players);
    }
  });

  // End game
  socket.on("endGame", () => {
    players.forEach(p => { p.alive = true; p.role = null; });
    votes = {};
    gameStarted = false;
    io.emit("broadcast", "🛑 Game has been ended by the host.");
    io.emit("updatePlayers", players);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

http.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`))


