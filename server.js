const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let players = []; // { id, name, token, alive, role, socketId }
let gameStarted = false;
let votingActive = false;
let votes = {};

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function assignRoles() {
  if (players.length < 2) return;
  const shuffled = shuffle([...players]);
  shuffled[0].role = "Killer";
  shuffled.slice(1).forEach((p) => (p.role = "Crewmate"));
}

function resetVotes() {
  votes = {};
}

function broadcastPlayers() {
  io.emit(
    "updatePlayers",
    players.map(({ name, alive }) => ({ name, alive }))
  );
}

function resetGame() {
  players.forEach((p) => (p.alive = true));
  assignRoles();
  resetVotes();
  players.forEach((p) => {
    if (p.socketId) io.to(p.socketId).emit("yourRole", p.role);
  });
  broadcastPlayers();
}

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Player joins via token
  socket.on("joinWithToken", (token) => {
    const player = players.find((p) => p.token === token);
    if (!player) return;
    player.socketId = socket.id;
    if (gameStarted) socket.emit("yourRole", player.role);
    broadcastPlayers();
  });

  // Host adds player
  socket.on("addPlayer", (name) => {
    const token = uuidv4();
    const player = {
      id: uuidv4(),
      name,
      token,
      alive: true,
      role: null,
      socketId: null,
    };
    players.push(player);
    socket.emit("playerLinkGenerated", player);
    broadcastPlayers();
  });

  // Host starts new game
  socket.on("startGame", () => {
    if (players.length < 2) return;
    resetGame();
    gameStarted = true;
    votingActive = false;
  });

  // Host restarts game (keeps players alive, reshuffles roles)
  socket.on("restartGame", () => {
    resetGame();
    votingActive = false;
    gameStarted = true;
  });

  // Host ends game (clears all players)
  socket.on("endGame", () => {
    gameStarted = false;
    votingActive = false;
    players = [];
    resetVotes();
    broadcastPlayers();
  });

  // Player toggles alive/dead (killer cannot mark dead)
  socket.on("toggleDead", (token) => {
    const player = players.find((p) => p.token === token);
    if (!player || player.role === "Killer") return;
    player.alive = !player.alive;
    io.emit("playerDeadMessage", player.name);
    broadcastPlayers();
  });

  // Start voting
  socket.on("startVoting", () => {
    if (!gameStarted) return;
    votingActive = true;
    resetVotes();
    io.emit("votingStarted");
  });

  // Player casts vote
  socket.on("castVote", ({ voterToken, targetName }) => {
    if (!votingActive) return;
    const voter = players.find((p) => p.token === voterToken);
    if (!voter || !voter.alive || votes[voterToken]) return; // only alive vote once
    votes[voterToken] = targetName;

    // Check if all alive players have voted
    const aliveCount = players.filter((p) => p.alive).length;
    if (Object.keys(votes).length === aliveCount) {
      // Count votes
      const count = {};
      Object.values(votes).forEach((name) => (count[name] = (count[name] || 0) + 1));
      const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
      const [eliminatedName] = sorted[0];
      const eliminated = players.find((p) => p.name === eliminatedName);
      if (eliminated) eliminated.alive = false;

      io.emit("votingResult", {
        name: eliminatedName,
        role: eliminated ? eliminated.role : "Unknown",
      });

      votingActive = false;
      broadcastPlayers();
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));