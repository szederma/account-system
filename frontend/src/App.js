import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';

const App = () => {
  const [token, setToken] = useState(null);

  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/login', { email, password });
      setToken(response.data.token);
      // Save token in localStorage or cookies
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<Account token={token} />} />
      </Routes>
    </Router>
  );
};

const Login = ({ onLogin }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  );
};

const Register = () => {
  return (
    <div>
      <h2>Register</h2>
      {/* Registration form logic */}
    </div>
  );
};

const Account = ({ token }) => {
  if (!token) {
    return <div>Please log in first.</div>;
  }

  return <div>Your account information here.</div>;
};

export default App;
