const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

// Sample user storage for testing (replace with a database later)
const users = [];

app.get('/', (req, res) => {
  res.send('Welcome to the backend!');
});

// Register route
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  users.push({ username, email, password: hashedPassword });
  res.status(201).json({ message: 'User registered!' });
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) return res.status(400).json({ message: 'User not found' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ email: user.email, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Profile route (Protected)
app.get('/account', (req, res) => {
  // You can add authentication logic here (JWT validation)
  res.json({ message: 'User account details' });
});

// Port setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});


const path = require('path');

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Handle all other requests by sending the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});
