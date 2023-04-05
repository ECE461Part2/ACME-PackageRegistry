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
    passHash TEXT NOT NULL,
    hash TEXT UNIQUE,
    admin INTEGER DEFAULT 0
  )
`);

//create package database
db.run(`
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    filename TEXT NOT NULL,
    stars INTEGER
  )
`);

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
    console.log("Reset users and packages")
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
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString).digest('hex')
  console.log("Got username: " + username);
  console.log("Login hash: " + hash)

  checkForReset(username, password)

  //look for user
  db.get('SELECT * FROM users WHERE username = ? AND passHash = ?', [username, passHash], (err, row) => {
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
      console.log("Incorrect username/password: " + username);
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
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString).digest('hex')
  console.log("Got username: " + username);
  console.log("Login hash: " + hash)
  
  //validate the password
  if (validatePassword(password) == 0) {
    res.render("register", { errorMessage:"Password must be minimum 8 characters with upper and lower case, and at least one number and special character"})
    return;
  }

  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      res.render("register", { errorMessage:"Account already exists, please login or choose a different username"})
    } else {
      //if new username, create new user
      db.run('INSERT INTO users (username, passHash, hash) VALUES (?, ?, ?)', [username, passHash, hash], function(err) {
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
      console.log("Logged in user: "+row.username)

      res.render('profile', {username: row.username})
    } else {
      //if not logged in, redirect to login page
      console.log("User hash not found... Redirecting to login")
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
    console.log("Logged out current user")
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
      db.all('SELECT nickname FROM packages', [], (err, rows) => {
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
      db.all('SELECT * FROM packages WHERE nickname LIKE ?', `%${query}%`, (err, rows) => {
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
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
    res.render('upload', { message: '' });
    } else {
      //if not logged in, redirect to login page
      res.redirect('/login')
    }
  })
});

//upload package
const storage = new Storage({
  projectId: 'registrylogintest',
  credentials: JSON.parse(process.env.BUCKET_CREDENTIALS)
});
const bucketName = 'day-package-registry-test';
const bucket = storage.bucket(bucketName);
const upload = multer();

app.post('/upload', upload.single('file'), async(req, res) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {

    const file = req.file;

    if (!file) {
      res.render('upload', { message: 'Please select a file.' });
      return;
    }
    console.log("Got filename: " + file.originalname)
    console.log("Package name: " + req.body.nickname)

    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      error(res, err);
      res.render('upload', { message: 'Failed to upload package. Please try again.' });
    });
    
    blobStream.on('finish', () => {
      console.log(`File ${file.originalname} uploaded to ${bucketName}`);
      db.run('INSERT INTO packages (nickname, filename, stars) VALUES (?, ?, ?)', [req.body.nickname, file.originalname, 0], function(err) {
        if (err) {
          error(res, err)
        } else {
          console.log(`Entry for ${file.originalname} saved to database`);
          res.render('upload', { message: 'Package uploaded successfully.' });
        }
      });
    });

    blobStream.end(file.buffer);

    } else {
      //if not logged in, redirect to login page
      res.redirect('/login')
    }
  })
});

// download a package
app.get('/download', async (req, res, next) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {

    //get the packages
    db.all('SELECT * FROM packages', [], (err, rows) => {
      if (err) {
        error(res, err)
        return
      }
      //render the page
      res.render('download', {packages: rows})
    })
    
  } else {
    //if not logged in, redirect to login page
    res.redirect('/login')
  }
})
});

app.get('/download/:filename', (req, res) => {
  //get the user hash
  const hash = req.cookies.hash

  //get the user info
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {

    const filename = req.params.filename;

    // sownload file from GCP bucket and send to client
    const file = storage.bucket(bucketName).file(filename);
    const stream = file.createReadStream();
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/octet-stream');
    stream.pipe(res);
    console.log(`File ${filename} downloaded from ${bucketName}`);
  
  } else {
    //if not logged in, redirect to login page
    res.redirect('/login')
  }
  })
});

var server=app.listen(8080,function() {});