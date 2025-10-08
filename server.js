const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');  // Required for static file paths
require('dotenv').config();

const app = express();

// CORS setup to allow requests from distanzuino.com
const corsOptions = {
  origin: 'https://distanzuino.com',  // Allow only this domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));  // Apply CORS with the specified options

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Serve static files directly from the "web" folder (assuming it's the root folder now)
app.use(express.static(path.join(__dirname)));  // Serve everything from the current directory

// Connect to PostgreSQL using the environment variable from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // For Render PostgreSQL connection
});

// Generate JWT token for user authentication
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '1h' });
};

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Check if email already exists
    const existingUser = await pool.query('SELECT * FROM app_user WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Insert new user into the database
    const result = await pool.query(
      'INSERT INTO app_user (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user);  // Generate a JWT token for the user
    res.status(201).json({ token, email: user.email });  // Respond with token and email
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const result = await pool.query('SELECT * FROM app_user WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Email not found' });
    }

    // Check if the password is correct
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = generateToken(user);  // Generate JWT token for successful login
    res.json({ token, email: user.email });  // Respond with token and email
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Protected user endpoint (for fetching logged-in user's data)
app.get('/api/user', async (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];  // Get token from Authorization header
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM app_user WHERE id = $1', [decoded.id]);  // Fetch user data from DB
    res.json(result.rows[0]);  // Respond with user data
  } catch (err) {
    console.error('Error fetching user data:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Serve static files from the "web" folder (frontend files)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test', 'index.html'));  // Serve the test page by default
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
