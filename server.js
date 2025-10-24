const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let players = []; // { id, name, linkId, alive, role, socketId }
let gameStarted = false;
let votingActive = false;

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function assignRoles() {
  if (players.length < 2) return;
  const shuffled = shuffle([...players]);
  shuffled[0].role = "Killer";
  shuffled.slice(1).forEach((p) => (p.role = "Crewmate"));
}

function resetGame() {
  players.forEach((p) => (p.alive = true));
  assignRoles();
  players.forEach((p) => {
    if (p.socketId) io.to(p.socketId).emit("yourRole", p.role);
  });
  io.emit("updatePlayers", players.map(({ name, alive }) => ({ name, alive })));
}

function broadcastPlayers() {
  io.emit(
    "updatePlayers",
    players.map(({ name, alive }) => ({ name, alive }))
  );
}

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("joinWithLink", (linkId, name) => {
    const player = players.find((p) => p.linkId === linkId);
    if (!player) return;
    player.name = name;
    player.socketId = socket.id;
    if (gameStarted) socket.emit("yourRole", player.role);
    broadcastPlayers();
  });

  socket.on("addPlayer", (name) => {
    const linkId = uuidv4();
    const player = {
      id: uuidv4(),
      name,
      linkId,
      alive: true,
      role: null,
      socketId: null,
    };
    players.push(player);
    socket.emit("playerLinkGenerated", player);
    broadcastPlayers();
  });

  socket.on("startGame", () => {
    if (players.length < 2) return;
    players.forEach((p) => (p.alive = true));
    assignRoles();
    gameStarted = true;
    votingActive = false;
    players.forEach((p) => {
      if (p.socketId) io.to(p.socketId).emit("yourRole", p.role);
    });
    broadcastPlayers();
  });

  socket.on("restartGame", () => {
    resetGame();
    votingActive = false;
    gameStarted = true;
  });

  socket.on("endGame", () => {
    gameStarted = false;
    votingActive = false;
    players = [];
    broadcastPlayers();
  });

  socket.on("toggleDead", (linkId) => {
    const player = players.find((p) => p.linkId === linkId);
    if (!player || player.role === "Killer") return;
    player.alive = !player.alive;
    io.emit("playerDeadMessage", player.name);
    broadcastPlayers();
  });

  socket.on("startVoting", () => {
    if (!gameStarted) return;
    votingActive = true;
    io.emit("votingStarted");
  });

  socket.on("voteResult", (eliminatedName) => {
    const eliminated = players.find((p) => p.name === eliminatedName);
    if (eliminated) eliminated.alive = false;
    io.emit("votingResult", {
      name: eliminatedName,
      role: eliminated ? eliminated.role : "Unknown",
    });
    votingActive = false;
    broadcastPlayers();
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));