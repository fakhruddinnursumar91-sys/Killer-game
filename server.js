const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = [];       // all player names
let roles = {};         // name -> role
let alive = {};         // name -> boolean
let tokens = {};        // token -> name
let votes = {};         // voter -> voted player
let gameStarted = false;
let votingStarted = false;

// emit updated player list to host
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

  // Mark self dead
  socket.on("markDead", (name) => {
    if(alive[name] && roles[name]!=="Killer"){
      alive[name] = false;
      io.emit("playerDied", name);
      emitPlayers();
      console.log(name, "marked dead");
    }
  });

  // Start voting
  socket.on("startVoting", () => {
    if(gameStarted && !votingStarted){
      votingStarted = true;
      votes = {};
      io.emit("votingStarted", alive);
      console.log("Voting started");
    }
  });

  // Player votes
  socket.on("vote", ({ voter, voted }) => {
    if(votingStarted && alive[voter] && alive[voted]){
      votes[voter] = voted;
      console.log(`${voter} voted for ${voted}`);

      // check if all alive voted
      const aliveCount = Object.values(alive).filter(a => a).length;
      if(Object.keys(votes).length === aliveCount){
        const count = {};
        Object.values(votes).forEach(v => count[v]=(count[v]||0)+1);
        const sorted = Object.entries(count).sort((a,b)=>b[1]-a[1]);
        const [eliminated, maxVotes] = sorted[0];
        alive[eliminated] = false;
        votingStarted = false;
        io.emit("votingResult", { eliminated, role: roles[eliminated] });
        emitPlayers();
      }
    }
  });

  // Get player name from token
  socket.on("getPlayerName", (token) => {
    const name = tokens[token];
    socket.emit("playerNameAssigned", name || "Unknown");
  });

  // Update players for host
  socket.emit("updatePlayers", players, alive);

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log("Server running on port", PORT));