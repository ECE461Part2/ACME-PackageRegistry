var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')

var app=express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
 
const sqlite3 = require('sqlite3');

//select database
var pathToDatabase = "./data/users.sql"
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
    username TEXT,
    password TEXT,
    hash TEXT UNIQUE
  )
`);

//create package database
/*
db.run(`
  CREATE TABLE IF NOT EXISTS packages (
    
  )
`);
*/

function login(res, hash, username) {
  console.log("Logged in: "+username)
  res.redirect(`/${hash}/profile`);
}

function error(res, err) {
  console.error(err);
  res.status(500).send("Internal error: "+err)
}

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

//login screen
app.get("/login", function (req, res) {
  res.render("login", { errorMessage:""});
});

//handle user login
app.post("/login", function (req, res) {
  var username = req.body.username
  var password = req.body.password
  var hash = crypto.createHash('sha256').update(username + password).digest('hex')
  console.log(username);
  console.log(password);
  console.log(hash)

  //look for hash
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if found, login
      login(res, row.hash, row.username)
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
  var hash = crypto.createHash('sha256').update(username + password).digest('hex')
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
        login(res, hash, username)
      });
    }
  })

});

app.get('/:hash/profile', (req, res) => {
  const { hash } = req.params;
  res.status(500).send("Logged in")


});


var server=app.listen(3000,function() {});