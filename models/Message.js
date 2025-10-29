// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },            // username
  content: { type: String, required: true },
  room: { type: String, default: 'global' },          // room name (or 'global')
  to: { type: String, default: null },                // optional recipient username for private messages
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
