const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads
// Note: For production, consider using a cloud storage service instead of local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Improved logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} request for: ${req.url}`);
  next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/homepage', (req, res) => {
  console.log('Serving homepage');
  res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

app.get('/alumni-registration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'alumni-registration.html'));
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
    
    connection.query(query, [firstName, lastName, email, hashedPassword], (error, results) => {
      if (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ error: 'Error creating user' });
        return;
      }
      res.status(201).json({ message: 'User created successfully' });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  const query = 'SELECT * FROM users WHERE email = ?';
  
  connection.query(query, [email], async (error, results) => {
    if (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Error during login' });
      return;
    }
    
    if (results.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (passwordMatch) {
      res.status(200).json({ 
        message: 'Login successful', 
        userName: `${user.first_name} ${user.last_name}`,
        redirectUrl: '/homepage'
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  });
});

// Alumni Registration endpoint
app.post('/alumni-registration', upload.single('photo'), (req, res) => {
  console.log('Received alumni registration request');
  console.log('Request body:', req.body);
  console.log('File:', req.file);

  const {
    name, permanent_address, present_address, gender, country_permanent, country_present,
    standard, state_permanent, state_present, passout_year, district_permanent,
    district_present, date_of_birth, city_permanent, city_present, current_designation,
    mobile_number, email
  } = req.body;

  const photo_path = req.file ? req.file.path : null;

  const query = `INSERT INTO alumni_registration 
    (name, permanent_address, present_address, gender, country_permanent, country_present,
    standard, state_permanent, state_present, passout_year, district_permanent,
    district_present, date_of_birth, city_permanent, city_present, current_designation,
    photo_path, mobile_number, email) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    name, permanent_address, present_address, gender, country_permanent, country_present,
    standard, state_permanent, state_present, passout_year, district_permanent,
    district_present, date_of_birth, city_permanent, city_present, current_designation,
    photo_path, mobile_number, email
  ];

  console.log('Executing query:', query);
  console.log('Query values:', values);

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error inserting alumni:', error);
      console.error('Error SQL state:', error.sqlState);
      console.error('Error code:', error.code);
      res.status(500).json({ error: 'Error registering alumni', details: error.message });
      return;
    }
    console.log('Alumni registered successfully:', results);
    res.status(201).json({ message: 'Alumni registered successfully', id: results.insertId });
  });
});

// New route for saving payment data
app.post('/save-payment', (req, res) => {
  const {
    fullName,
    email,
    standard,
    fees,
    cardName,
    cardNumber,
    expMonth,
    expYear,
    cvv
  } = req.body;

  // In a real-world scenario, you should never store full credit card details.
  // This is just for demonstration purposes.
  const query = `INSERT INTO payments 
    (full_name, email, standard, fees, card_name, card_number, exp_month, exp_year, cvv)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [fullName, email, standard, fees, cardName, cardNumber, expMonth, expYear, cvv];

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error saving payment:', error);
      res.status(500).json({ error: 'Error saving payment', details: error.message });
      return;
    }
    console.log('Payment saved successfully:', results);
    res.status(201).json({ message: 'Payment saved successfully', id: results.insertId });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});