const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// DB setup
const db = new sqlite3.Database('./database.db');
// Create users table if not exists
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  email TEXT,
  isAdmin INTEGER DEFAULT 0
)`);

db.run(`INSERT OR IGNORE INTO users (username, password, email, isAdmin) VALUES ('admin', 'admin123', 'admin@example.com', 1)`);



// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static('public'));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
function authMiddleware(req, res, next) {
  if (req.session.userId) next();
  else res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/signup', (req, res) => {
  res.render('signup', { message: '' });
});

app.post('/signup', (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.render('signup', { message: 'All fields are required' });
  }

  const stmt = db.prepare("INSERT INTO users (username, password, email) VALUES (?, ?, ?)");
  stmt.run(username, password, email, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.render('signup', { message: 'Username already exists' });
      }
      return res.render('signup', { message: 'Signup error' });
    }
    res.redirect('/login');
  });
  stmt.finalize();
});

app.get('/login', (req, res) => {
  res.render('login', { message: '' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err || !user) {
      return res.render('login', { message: 'Invalid username or password' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/home');
  });
});

app.get('/home', authMiddleware, (req, res) => {
  res.render('home', { username: req.session.username });
});

app.get('/profile', authMiddleware, (req, res) => {
  db.get("SELECT username, email FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) return res.redirect('/home');
    res.render('profile', { user, message: '' });
  });
});

app.post('/profile', authMiddleware, (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.render('profile', { user: { username, email }, message: 'Fields cannot be empty' });
  }

  db.run("UPDATE users SET username = ?, email = ? WHERE id = ?", [username, email, req.session.userId], (err) => {
    if (err) {
      return res.render('profile', { user: { username, email }, message: 'Error updating profile' });
    }
    req.session.username = username;
    res.render('profile', { user: { username, email }, message: 'Profile updated successfully' });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
