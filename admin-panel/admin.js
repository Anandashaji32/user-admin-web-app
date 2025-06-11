const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 4000; // Admin panel will run on port 4000

// DB setup — path to your main database!
const db = new sqlite3.Database('../database.db');


// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'admin-secret-key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static('public'));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Admin auth middleware
function adminAuthMiddleware(req, res, next) {
  if (req.session.adminId) next();
  else res.redirect('/login');
}

// Routes

// Admin Login Page
app.get('/login', (req, res) => {
  res.render('login', { message: '' });
});

// Admin Login POST
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ? AND isAdmin = 1", [username, password], (err, admin) => {
    if (err || !admin) {
      return res.render('login', { message: 'Invalid admin credentials' });
    }
    req.session.adminId = admin.id;
    res.redirect('/dashboard');
  });
});

// Admin Dashboard
app.get('/dashboard', adminAuthMiddleware, (req, res) => {
  const search = req.query.search || '';
  const query = search
    ? `SELECT * FROM users WHERE username LIKE ?`
    : `SELECT * FROM users`;

  const params = search ? [`%${search}%`] : [];

  db.all(query, params, (err, users) => {
    if (err) {
      return res.render('dashboard', { users: [], message: 'Error fetching users' });
    }
    res.render('dashboard', { users, message: '' });
  });
});

// Edit User Page
app.get('/edit/:id', adminAuthMiddleware, (req, res) => {
  const userId = req.params.id;
  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (err || !user) {
      return res.redirect('/dashboard');
    }
    res.render('edit', { user, message: '' });
  });
});

// Edit User POST
app.post('/edit/:id', adminAuthMiddleware, (req, res) => {
  const userId = req.params.id;
  const { username, email, isAdmin } = req.body;
  db.run(
    "UPDATE users SET username = ?, email = ?, isAdmin = ? WHERE id = ?",
    [username, email, isAdmin ? 1 : 0, userId],
    (err) => {
      if (err) {
        return res.render('edit', { user: { id: userId, username, email, isAdmin }, message: 'Error updating user' });
      }
      res.redirect('/dashboard');
    }
  );
});

// Delete User
app.get('/delete/:id', adminAuthMiddleware, (req, res) => {
  const userId = req.params.id;
  db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
    if (err) {
      return res.redirect('/dashboard');
    }
    res.redirect('/dashboard');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Admin panel running at http://localhost:${PORT}`);
});
