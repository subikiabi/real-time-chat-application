// public/chat.js
const socket = io();

// UI elements
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const btnJoin = document.getElementById('btnJoin');
const currentRoomLabel = document.getElementById('currentRoom');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const usersList = document.getElementById('users');
const privateToInput = document.getElementById('privateTo');
const btnPrivate = document.getElementById('btnPrivate');

let currentRoom = null;
let myUsername = null;

function addMessage(msgObj, highlight=false) {
  const el = document.createElement('div');
  el.className = 'message';
  if (highlight) el.classList.add('highlight');
  const time = new Date(msgObj.createdAt).toLocaleTimeString();
  let toPart = msgObj.to ? ` (to ${msgObj.to})` : '';
  el.innerHTML = `<strong>${escapeHtml(msgObj.sender)}</strong>${toPart}: ${escapeHtml(msgObj.content)} <span class="time">${time}</span>`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

btnJoin.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const room = roomInput.value.trim() || 'global';
  if (!username) return alert('Please enter username');
  myUsername = username;
  socket.emit('register', username);
  socket.emit('joinRoom', room);
  currentRoom = room;
  currentRoomLabel.textContent = `Room: ${room}`;
  messagesDiv.innerHTML = '';
});

sendBtn.addEventListener('click', () => {
  const text = msgInput.value.trim();
  if (!text) return;
  if (!currentRoom) return alert('Join a room first');
  socket.emit('roomMessage', { room: currentRoom, content: text });
  msgInput.value = '';
});

btnPrivate.addEventListener('click', () => {
  const to = privateToInput.value.trim();
  const content = msgInput.value.trim();
  if (!to || !content) return alert('Provide recipient and message (message in box)');
  socket.emit('privateMessage', { to, content });
  msgInput.value = '';
});

// socket listeners
socket.on('roomHistory', ({ room, history }) => {
  // show history
  messagesDiv.innerHTML = '';
  history.forEach(m => addMessage(m));
});

socket.on('newRoomMessage', (msg) => {
  // if it belongs to current room show
  if (msg.room === currentRoom) addMessage(msg);
});

socket.on('newPrivateMessage', (msg) => {
  // show private messages with highlight
  addMessage(msg, true);
});

socket.on('user_list', (users) => {
  usersList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    usersList.appendChild(li);
  });
});

// keyboard enter to send message
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnJoin.click();
});

