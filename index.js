// YOU CAN USE THIS FILE AS REFERENCE FOR SERVER DEVELOPMENT

// include the express modules
var express = require("express");
const path = require('path');

// create an express application
var app = express();
const url = require('url');

// helps in extracting the body portion of an incoming request stream
var bodyParser = require('body-parser'); // this has been depricated, is now part of express...

// fs module - provides an API for interacting with the file system
var fs = require("fs");

// helps in managing user sessions
var session = require('express-session');

// include the postgresql module
const { Pool } = require('pg');
const dbConfig = require('./config.js');
const pool = new Pool(dbConfig);

// Bcrypt library for comparing password hashes
const bcrypt = require('bcrypt');
const saltRounds = 10; // For hashing the password

// A possible library to help reading uploaded file.
// var formidable = require('formidable');

// apply the body-parser middleware to all incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// view engine





// use express-session
// in mremory session is sufficient for this assignment
app.use(session({
  secret: "csci4131secretkey",
  saveUninitialized: true,
  resave: false
}
));


// server listens on port 9007 for incoming connections
app.listen(9007, () => console.log('Listening on port 9007!'));

//handle new users
app.post('/api/accountForm', async (req, res) => {
    const { email, name, password } = req.body;
  
    if (!email || !name || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const queryText = 'INSERT INTO Users (email, name, password) VALUES ($1, $2, $3) RETURNING *';
      const values = [email, name, hashedPassword];
  
      const result = await pool.query(queryText, values);
      const newUser = result.rows[0];
  
      res.status(201).json({ success: true, message: 'Account created successfully', user: newUser });
    } catch (error) {
      console.error(error);
      if (error.code === '23505') {
        // Unique violation (duplicate email)
        res.status(400).json({ success: false, message: 'Email already exists' });
      } else {
        res.status(500).json({ success: false, message: 'An error occurred' });
      }
    }
  });


//handle logouts
app.post('/api/logout', (req, res) => {
  // Destroy the session and handle the result
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      res.status(500).send('Could not log out, server error');
    } else {
      res.status(200).json({ success: true });

    }
  });
});
//function to handle login form post request
app.post('/api/loginForm', async (req, res) => {
    
      const { username, password } = req.body;
      email = username; // kinda dumb whatever
      const query = 'SELECT * FROM Users WHERE email = $1';
      const params = [email];
      console.log(email);
      console.log(password);
     try {
    
        const result = await pool.query(query, params);
        const user = result.rows[0]
      
        if (!user) {
          console.log("couldn't find user")
          return res.status(400).json({ success: false, message: "Username does not exist" });
        }

        console.log(user);
        console.log(user.password)
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            console.error('Encryption error', err);
            return res.status(500).json({ success: false, message: "Encryption error" });
          }
          if (isMatch) {
            // save session id
            req.session.user_id = user.user_id;
            req.session.isLoggedIn = true;
            res.status(200).json({ success: true, data: 'success' });
          } else {
            console.log("incorrect password");
            res.status(401).json({ success: false, data: "username and password don't match" });
          }

        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'An error occurred' });
      }
    
});
app.post('/api/receiptEntry', (req, res) => {
//   const dbCon = mysql.createConnection({
//     host: "cse-mysql-classes-01.cse.umn.edu",
//     user: "C4131S24DU81",               
//     password: "6611",                  
//     database: "C4131S24DU81",
//   });
//   let event_info = req.body;
//   console.log(event_info);
//   dbCon.connect(function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: "Database error" });
//     }
//     var sql = 
//     `INSERT INTO tbl_events (event_day, event_event, event_start, event_end, event_location, event_phone, event_info, event_url)`
//     + ` VALUES ('${event_info.day}', '${event_info.event}', '${event_info.start}', '${event_info.end}', '${event_info.location}', '${event_info.phone}', '${event_info.info}', '${event_info.url}')`
//     ;
//     dbCon.query(sql, (error, results) => {
//       dbCon.end(); // after qury close connection
//       if (error) {
//         console.error('Database error', error);
//         return res.status(500).json({ success: false, message: "Database error" });
//       } else {
//         return res.status(200).json({success: true, message: "succesfully inserted"})
//       }
      
//     });
//   });
});


// all the static file functions
app.get('/',function(req, res) {
    res.sendFile(path.join(__dirname, 'static', 'welcome.html'));
});

app.get('/createAccount.html', function(req, res) {
    if (req.session && req.session.isLoggedIn) {
      res.redirect('/home.html');
    } else {
      res.sendFile(path.join(__dirname, 'static', 'createAccount.html'));
    }
  });
app.get('/login.html', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.redirect('/home.html');
  } else {
    res.sendFile(path.join(__dirname, 'static', 'login.html'));
  }
});
app.get('/home.html', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'static', 'home.html'));
  } else {
    res.redirect('/login.html');
  }
});
app.get('/addReceipt', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'addReceipt'));
  } else {
    res.redirect('/login.html');
  }
});
// middle ware to serve static files
app.use('/static', express.static(__dirname + '/static'));
// function to return the 404 message and error to client
app.get('*', function(req, res) {
  // add details
  res.sendStatus(404);
});
