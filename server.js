const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = []; // list of players
let roles = {};   // roles assigned
let alive = {};   // alive status

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("addPlayer", (playerName) => {
    if (!players.includes(playerName)) {
      players.push(playerName);
      alive[playerName] = true;
      io.emit("playerAdded", playerName);
      console.log("Player added:", playerName);
    }
  });

  socket.on("markDead", (playerName) => {
    alive[playerName] = false;
    io.emit("playerDied", playerName);
    console.log("Player dead:", playerName);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));