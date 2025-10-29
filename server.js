// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST endpoints (optional, useful for fetching history)
app.get('/api/messages/:room', async (req, res) => {
  const room = req.params.room || 'global';
  try {
    const messages = await Message.find({ room }).sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/private/:userA/:userB', async (req, res) => {
  // fetch messages between userA and userB (private messages)
  const { userA, userB } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { sender: userA, to: userB },
        { sender: userB, to: userA }
      ]
    }).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch private messages' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Map username -> socket.id (for simple private messaging)
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  // register username with this socket
  socket.on('register', (username) => {
    if (!username) return;
    socket.username = username;
    userSockets.set(username, socket.id);
    console.log(`User registered: ${username} -> ${socket.id}`);
    // notify everyone about user join (optional)
    io.emit('user_list', Array.from(userSockets.keys()));
  });

  // join a room
  socket.on('joinRoom', async (room) => {
    room = room || 'global';
    socket.join(room);
    console.log(`${socket.username || socket.id} joined room ${room}`);

    // send last 100 messages of the room to this socket
    try {
      const history = await Message.find({ room }).sort({ createdAt: 1 }).limit(100);
      socket.emit('roomHistory', { room, history });
    } catch (err) {
      console.warn('error fetching room history', err);
    }
  });

  // leave a room
  socket.on('leaveRoom', (room) => {
    socket.leave(room);
  });

  // broadcast message to a room (or to global)
  socket.on('roomMessage', async ({ room = 'global', content }) => {
    const sender = socket.username || 'Anonymous';
    const msg = new Message({ sender, content, room });
    try {
      await msg.save();
      io.to(room).emit('newRoomMessage', msg); // emit saved message to room
    } catch (err) {
      console.error('save message err', err);
    }
  });

  // private message: send to specific username
  socket.on('privateMessage', async ({ to, content }) => {
    const from = socket.username || 'Anonymous';
    const msg = new Message({ sender: from, to, content, room: `private:${[from,to].sort().join('-')}` });
    try {
      await msg.save();
    } catch (err) {
      console.error('save private message err', err);
    }

    // deliver to recipient if online
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('newPrivateMessage', msg);
    }
    // also send to sender to confirm delivery
    socket.emit('newPrivateMessage', msg);
  });

  // handle disconnect
  socket.on('disconnect', () => {
    if (socket.username) {
      userSockets.delete(socket.username);
      io.emit('user_list', Array.from(userSockets.keys()));
    }
    console.log('socket disconnected:', socket.id);
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/realtime-chat';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
