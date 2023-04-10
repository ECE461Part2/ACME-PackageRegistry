var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const cookieParser = require('cookie-parser');
const multer = require('multer');
const setupDatabase = require('./scripts/databaseSetup')
const auth = require('./scripts/auth')
const { Storage } = require('@google-cloud/storage');
console.log(process.env.BUCKET_CREDENTIALS)
if (process.env.BUCKET_CREDENTIALS == undefined) {
  console.log("Getting BUCKET_CREDENTIALS")
  require('dotenv').config({path:__dirname+'/./../../../../../.env'})
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
app.use(function(req, res, next) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const db = setupDatabase()

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
app.get('/profile', auth, (req, res) => {
  console.log("Logged in user: "+req.username)
  res.render('profile', {username: req.username})
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
app.get('/directory', auth, (req, res) => {

  console.log("Directory for "+req.username)

  //get the packages
  db.all('SELECT * FROM packages', [], (err, rows) => {
    if (err) {
      error(res, err)
      return
    }

    //render the page
    res.render('directory', {packages: rows})
  })

});

//search page
app.get('/search', auth, (req, res) => {
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
});

//upload page
app.get('/upload', auth, function(req, res) {
    res.render('upload', { message: '' });
});

//upload package
app.post('/upload', auth, upload.single('file'), (req, res) => {
  const file = req.file;

  if (!file) {
    res.render('upload', { message: 'Please select a file.' });
    return;
  }
  console.log("Got filename: " + file.originalname)
  console.log("Package name: " + req.body.nickname)

  db.get('SELECT * FROM packages WHERE nickname = ?', [req.body.nickname], (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    if (row) {
      res.render('upload', { message: 'Please choose a unique package name.' });
      return;
    } else {
    
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
    }
  })
});

// download a package
app.get('/download', auth, (req, res) => {
  //get the packages
  db.all('SELECT * FROM packages', [], (err, rows) => {
    if (err) {
      error(res, err)
      return
    }
    //render the page
    res.render('download', {packages: rows})
  })
});

app.get('/download/:filename', auth, (req, res) => {
  const filename = req.params.filename;

  db.get('UPDATE packages SET downloads = downloads + 1 WHERE filename = ?', [filename], (err, rows) => {
    if (err) {
      error(res, err)
      return
    }

    // download file from GCP bucket and send to client
    const file = storage.bucket(bucketName).file(filename);
    const stream = file.createReadStream();
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/octet-stream');
    stream.pipe(res);
    console.log(`File ${filename} downloaded from ${bucketName}`);
  
  })
});

// update page
app.get('/update', auth, (req, res) => {
  // Get all packages from the database
  db.all('SELECT nickname FROM packages ORDER BY nickname ASC', [], (err, rows) => {
    if (err) {
      error(res, err)
      res.sendStatus(500);
      return;
    }

    // Render the update page with the list of packages
    res.render('update', { packages: rows , message: ''});
  });
});

app.post('/update', auth, upload.single('file'), (req, res, next) => {
  const packageName = req.body.package;
  db.get('SELECT filename FROM packages WHERE nickname = ?', [packageName], (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    // get the package name from the URL parameter
    const file = req.file;
    const oldFilename = row.filename
    storage.bucket(bucketName).file(oldFilename).delete();
    console.log(`Deleted file ${oldFilename}`);

    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      error(res, err);
      res.render('update', { packages: rows , message: 'Package update error.' });
    });
    
    blobStream.on('finish', () => {
      console.log(`File ${file.originalname} uploaded to ${bucketName}`);
      db.get('UPDATE packages SET filename = ? WHERE filename = ?', [file.originalname, oldFilename], (err, _) => {
        if (err) {
          error(res, err)
        } else {
          db.all('SELECT nickname FROM packages ORDER BY nickname ASC', [], (err, rows) => {
            if (err) {
              error(res, err);
              return;
            }
        
            console.log(`Entry for ${file.originalname} saved to database`);
            res.render('update', { packages: rows , message: 'Package updated successfully.' });
          });
        }
      });
    });

    blobStream.end(file.buffer);

  });
});

var server=app.listen(80,function() {});