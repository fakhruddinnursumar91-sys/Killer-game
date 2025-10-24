const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = [];       // list of player names
let roles = {};         // name -> role
let alive = {};         // name -> boolean
let tokens = {};        // token -> player name
let votes = {};         // voter -> voted player
let gameStarted = false;
let votingStarted = false;

// Send updated player list to host
function emitPlayers() {
  io.emit("updatePlayers", players, alive);
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Add player
  socket.on("addPlayer", (name) => {
    if(!gameStarted && name && !players.includes(name)){
      players.push(name);
      alive[name] = true;
      const token = crypto.randomBytes(4).toString("hex");
      tokens[token] = name;
      socket.emit("playerToken", { name, token });
      emitPlayers();
      console.log("Player added:", name, "Token:", token);
    }
  });

  // Start game
  socket.on("startGame", () => {
    if(!gameStarted && players.length >= 2){
      gameStarted = true;
      const shuffled = [...players].sort(()=>Math.random()-0.5);
      roles = {};
      roles[shuffled[0]] = "Killer";
      shuffled.slice(1).forEach(p=>roles[p]="Crewmate");
      votes = {};
      io.emit("gameStarted", roles);
      console.log("Game started", roles);
    }
  });

  // End game
  socket.on("endGame", () => {
    gameStarted = false;
    votingStarted = false;
    players = [];
    roles = {};
    alive = {};
    tokens = {};
    votes = {};
    io.emit("gameEnded");
    console.log("Game ended");
  });

  // Player marks self dead
  socket.on("markDead", (name) => {
    if(alive[name] && roles[name]!=="Killer"){
      alive[name] = false;
      io.emit("playerDied", name);
      emitPlayers();
      console.log("Player dead:", name);
    }
  });

  // Start voting
  socket.on("startVoting", () => {
    if(gameStarted && !votingStarted){
      votingStarted = true;
      votes = {};
      io.emit("votingStarted");
      console.log("Voting started");
    }
  });

  // Voting by players
  socket.on("vote", ({ voter, voted }) => {
    if(votingStarted && alive[voter] && voted && alive[voted]){
      votes[voter] = voted;
      console.log(`${voter} voted for ${voted}`);
      // check if all alive players voted
      const aliveCount = Object.values(alive).filter(a => a).length;
      if(Object.keys(votes).length === aliveCount){
        // count votes
        const count = {};
        Object.values(votes).forEach(v => count[v] = (count[v]||0)+1);
        const sorted = Object.entries(count).sort((a,b)=>b[1]-a[1]);
        const [eliminated, maxVotes] = sorted[0];
        const role = roles[eliminated];
        alive[eliminated] = false;
        io.emit("votingResult", { eliminated, role });
        emitPlayers();
        votingStarted = false;
        console.log("Voting ended:", eliminated, role);
      }
    }
  });

  // Player requests name via token
  socket.on("getPlayerName", (token) => {
    const name = tokens[token];
    socket.emit("playerNameAssigned", name || "Unknown");
  });

  // Send current player list to new connection
  socket.emit("updatePlayers", players, alive);

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));