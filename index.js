var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const multer = require('multer');
const AdmZip = require("adm-zip");
const {exec} = require('child_process')
const path = require('path');
const shell = require('shelljs')
const fs = require('fs');
const setupDatabase = require('./scripts/databaseSetup')
const auth = require('./scripts/auth')
const { Storage } = require('@google-cloud/storage');
console.log(process.env.BUCKET_CREDENTIALS)
if (process.env.BUCKET_CREDENTIALS == undefined) {
  console.log("Getting BUCKET_CREDENTIALS")
  require('dotenv').config({path:__dirname+'/./../../../.env'})

}
console.log(process.env.BUCKET_CREDENTIALS)

const storage = new Storage({
  projectId: 'registrylogintest',
  credentials: JSON.parse(process.env.BUCKET_CREDENTIALS)
});
const bucketName = 'day-package-registry-test';
const bucket = storage.bucket(bucketName);
const upload = multer();


var app=express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json({type:'application/json', limit:'50mb'}));
app.use(express.urlencoded({limit: '50mb', extended:true, paramaterLimit:50000}));
app.use(function(req, res, next) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const db = setupDatabase()

function send400(res, err) {
  console.error(err)
  res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
}

function error(res, err) {
  console.error(err);
  res.status(500).send("Internal error: "+err)
}

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

app.post('/packages', auth, (req, res) => {
  // Get the offset parameter from the query string
  const offset = req.query.offset || '';
  console.log("offset: ", offset)
  
  const packageQuery = req.body
  console.log("package query: " + JSON.stringify(packageQuery))
  console.log("package query: " + JSON.stringify(packageQuery.map(pkg => pkg.Name)))
  console.log(`SELECT * FROM packages WHERE packageName IN (${packageQuery.map(() => '?').join(', ')})`)


  db.all(`SELECT DISTINCT version, packageName, id FROM packages WHERE packageName IN (${packageQuery.map(() => '?').join(', ')})`, packageQuery.map(pkg => pkg.packageName), (err, rows) => {
    if (err) {
      console.error(err);
      return;
    } else {
      console.log(rows)
      if (rows.length > 50) {
        res.status(413).json()
      }
      // const filteredRows = rows.map(row => ({ version: row.version, packageName: row.packageName }));
      res.status(200).json(rows)
    }
  })

});

app.get('/package/:id', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

  res.status(200).json({"you get":"downloaded your package bro"})

});

app.put('/package/:id', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

  res.status(200).json({"you get":"updated your package bro"})

});

app.delete('/package/:id', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

  res.status(200).json({"you get":"deleted your package bro"})

});

app.get('/package/:id/rate', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

  res.status(200).json({"you get":"rated your package bro"})

});

//login screen
app.get("/", function (req, res) {
  res.redirect("/authenticate");
});

//login screen
app.get("/authenticate", function (req, res) {
  res.render("authenticate");
});

//handle user login
app.put("/authenticate", function (req, res) {
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  var password = req.body.Secret.password
  var isAdmin  = req.body.User.isAdmin
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString()).digest('hex')
  console.log("Got username: " + username);
  console.log("Got password: " + password);
  console.log("Got admin: " + isAdmin);
  console.log("Login hash: " + hash)
  if (username == undefined || username == "" || password == undefined || password == "") {
    res.status(400).json("Please provide a username and password")
    return;
  }

  authorization = "bearer " + hash

  //look for user
  db.get('SELECT * FROM users WHERE username = ? AND passHash = ?', [username, passHash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if found, update hash and login
      db.run('UPDATE users SET hash = ? WHERE id = ?', [hash, row.id], err => {
        if (err)
          error(res, err)
        console.log("Authentication success " + username);
        res.status(200).json({
          authorization
        })
      });
    } else {
      //if not found, prompt not found
      console.log("Incorrect username/password: " + username);
      res.status(401).json()
      // res.render("login", { errorMessage:"Username/password not found"})
    }
  })
  res.status(501).json
});

app.put("/register", auth, function (req, res) {
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  var password = req.body.Secret.password
  var isAdmin  = req.body.User.isAdmin
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString()).digest('hex')
  console.log("Got username: " + username);
  console.log("Got password: " + password);
  console.log("Got admin: " + isAdmin);
  console.log("Login hash: " + hash)
  if (req.isAdmin != true) {
    res.status(401).json("Must be admin to complete this action")
    return;
  }

  if (username == undefined || username == "" || password == undefined || password == "") {
    res.status(400).json("Please provide a username and password")
    return;
  }
  
  //validate the password
  if (validatePassword(password) == 0) {
    res.status(400).json("Password must be minimum 8 characters with upper and lower case, and at least one number and special character")
    return;
  }

  value = "bearer " + hash
  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      res.status(400).json("Account already exists, please login or choose a different username")
    } else {
      //if new username, create new user
      db.run('INSERT INTO users (username, passHash, hash, admin) VALUES (?, ?, ?, ?)', [username, passHash, hash, isAdmin], function(err) {
        if (err)
          error(res, err)
        res.status(200).json({
          value
        })
      });
    }
  })

});

app.delete("/register", auth, function (req, res) {
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  console.log("Got username: " + username);
  if (req.isAdmin != true && req.username != username) {
    res.status(401).json("Must be admin or this user to complete this action")
    return;
  }

  if (username == undefined || username == "") {
    res.status(400).json("Please provide a username")
    return;
  }

  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
        if (err) {
          error(res, err)
        } else {
          res.status(200).json("Deleted user")
        }
      });
    } else {
      res.status(400).json("Account does not exist, please choose a different username")
    }
  })

});

app.delete("/reset", auth, function (req, res) {
  console.log("body: " + JSON.stringify(req.body))
  var username = req.username
  console.log("Got username: " + username);
  if (username == undefined) {
    res.status(400).json()
  }
  if (req.isAdmin != true) {
    res.status(401).json("You do not have permission to reset the registry.")
    return;
  }

  db.run('DELETE FROM users; DELETE FROM packages;', function(err) {
    if (err) {
      error(res, err)
    } else {
      console.log("Reset users and packages")
    
      var passHash =crypto.createHash('sha256').update('correcthorsebatterystaple123(!__+@**(A’”`;DROP TABLE packages;').digest('hex')
    
      db.run('INSERT INTO users (username, admin, passHash) VALUES (?, ?, ?)', ['ece461defaultadminuser', true, passHash], function(err) {
        if (err) {
          error(res, err)
        } else {
          res.status(200).send(JSON.stringify({ message: "Reset users and packages" }));
        }
      });
    }
  })

});

//search page

app.post('/package/byRegEx', auth, (req, res) => {
  console.log("body: " + JSON.stringify(req.body))
  const query = req.body.RegEx
  //query the database for packages matching the search term
  //TODO: get regexp working
  db.all('SELECT DISTINCT version, id, packageName FROM packages WHERE packageName REGEXP ?', `%${query}%`, (err, rows) => {
    if (err) {
      console.error(err);
      res.render('error');
      return;

    } if (rows) {
      res.status(200).json(rows)
    } else {
      res.status(404).json()
    }
  });
});

//user profile page
app.get('/profile', (req, res) => {
  console.log("Logged in user: "+req.username)
  return res.render('profile', {username: req.username})
});


var server=app.listen(80,function() {});
