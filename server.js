// Add PUT /api/user route to update user data
app.put('/api/user', async (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { username, password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Update user in the database
    let query = 'UPDATE app_user SET ';
    let values = [];
    let updateFields = [];

    if (username) {
      updateFields.push('username = $' + (updateFields.length + 1));
      values.push(username);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = $' + (updateFields.length + 1));
      values.push(hashedPassword);
    }

    query += updateFields.join(', ') + ' WHERE id = $' + (updateFields.length + 1) + ' RETURNING *';
    values.push(decoded.id);

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user data:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});
