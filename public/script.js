// Shared frontend logic for host/player

// This file can later be expanded with:
// - voting
// - revealing roles
// - updating player statuses
// Right now it just keeps Socket.io connection open.
const socket = io();