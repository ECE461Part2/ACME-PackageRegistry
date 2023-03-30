var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const sqlite3 = require('sqlite3');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

var app=express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());



//select database
var pathToDatabase = "./data/database.sql"
const db = new sqlite3.Database(pathToDatabase, (err) => {
  if (err) {
    console.error("Database error: "+err.message);
  } else {
    console.log('Connected to the database ' + pathToDatabase);
  }
});

//create user database
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    hash TEXT UNIQUE,
    admin INTEGER DEFAULT 0
  )
`);

//create package database
db.run(`
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    stars INTEGER
  )
`);

db.run(`
  INSERT INTO packages (name, path, stars)
  VALUES (
    'Test Package',
    'path/to/package.zip',
    74
  )
`)

function error(res, err) {
  console.error(err);
  res.status(500).send("Internal error: "+err)
}

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

function checkForReset(username, password) {
  if (username == "adminReset" & password == "adminReset") {
    db.run('DELETE FROM users; DELETE FROM packages;')
  }
}

//login screen
app.get("/", function (req, res) {
  res.redirect("/login");
});

//login screen
app.get("/login", function (req, res) {
  res.render("login", { errorMessage:""});
});

//handle user login
app.post("/login", function (req, res) {
  var username = req.body.username
  var password = req.body.password
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString).digest('hex')
  console.log(username);
  console.log(password);
  console.log(hash)

  checkForReset(username, password)

  //look for user
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if found, update hash and login
      db.run('UPDATE users SET hash = ? WHERE id = ?', [hash, row.id], err => {
        if (err)
          error(res, err)
        res.cookie('hash', hash)
        res.redirect(`/profile`);
      });
    } else {
      //if not found, prompt not found
      console.log("Incorrect username/password: "+username);
      res.render("login", { errorMessage:"Username/password not found"})
    }
  })
});

//register screen
app.get("/register", function (req, res) {
  res.render("register", { errorMessage:""});
});
  
//handle user register
app.post("/register", function (req, res) {
  var username = req.body.username
  var password = req.body.password
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString).digest('hex')
  console.log(username);
  console.log(password);
  console.log(hash)
  
  //validate the password
  if (validatePassword(password) == 0) {
    res.render("register", { errorMessage:"Password must be minimum 8 characters with upper and lower case, and at least one number and special character"})
    return;
  }

  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    console.log(row)
    if (err) {
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      res.render("register", { errorMessage:"Account already exists, please login or choose a different username"})
    } else {
      //if new username, create new user
      db.run('INSERT INTO users (username, password, hash) VALUES (?, ?, ?)', [username, password, hash], function(err) {
        if (err)
          error(res, err)
        //store the user hash and redirect
        res.cookie('hash', hash)
        res.redirect(`/profile`);
      });
    }
  })

});

//user profile page
app.get('/profile', (req, res) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      console.log("Logged in "+row.username)

      //get the packages
      db.all('SELECT name FROM packages', [], (err, rows) => {
        if (err) {
          error(res, err)
          return
        }
        const packageNames = rows.map(row => row.name)

        //render the profile
        res.render('profile', {username: row.username, packages: packageNames})
      })
    } else {
      //if not logged in, redirect to login page
      res.redirect('/login')
    }

  })

});

//logout page
app.get('/logout', function(req, res) {
  //get the current hash cookie
  const hash = req.cookies.hash

  //delete the hash cookie
  res.clearCookie('hash');

  //update the hash in the user database to null
  db.run(`UPDATE users SET hash = NULL WHERE hash = ?`, hash, function(err) {
    if (err) {
      error(res, err)
      return;
    }
    //redirect to the login page
    res.redirect('/login');
  });
});

//package directory page
app.get('/directory', (req, res) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      console.log("Directory for "+row.username)

      //get the packages
      db.all('SELECT name FROM packages', [], (err, rows) => {
        if (err) {
          error(res, err)
          return
        }

        //render the page
        res.render('directory', {packages: rows})
      })
    } else {
      //if not logged in, redirect to login page
      res.redirect('/login')
    }

  })

});

//search page
app.get('/search', (req, res) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      const query = req.query.query;
      if (!query) {
        res.render('search', { query: "", results: [] });
        return;
      }
      //query the database for packages matching the search term
      db.all('SELECT * FROM packages WHERE name LIKE ?', `%${query}%`, (err, rows) => {
        if (err) {
          console.error(err);
          res.render('error');
          return;
        }
        res.render('search', { query: query, results: rows });
      });
    } else {
      //if not logged in, redirect to login page
      res.redirect('/login')
    }
  })
});

//upload page
app.get('/upload', function(req, res) {
  res.render('upload');
});

//upload package
const storage = new Storage({
  projectId: 'registrylogintest',
  credentials: process.env.BUCKET_CREDENTIALS
});
const bucketName = 'day-package-registry-test';
const upload = multer();


app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const fileName = file.originalname;
  const fileSize = file.size;
  console.log("key: "+process.env.BUCKET_CREDENTIALS)

  const options = {
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl(options);

  const config = {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileSize,
    },
  };

  await axios.put(url, file.buffer, config);

  res.send('File uploaded successfully.');
});
 


var server=app.listen(8080,function() {});