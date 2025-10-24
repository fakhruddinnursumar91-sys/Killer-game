const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public")); // ✅ Serve files from 'public' folder

// Test socket connection
io.on("connection", (socket) => {
  console.log("🟢 A player connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 A player disconnected:", socket.id);
  });
});

// Use Render's PORT environment variable
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));