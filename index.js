var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
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
app.use(express.json({type:'application/json'}));
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

app.post('/packages', auth, (req, res) => {
  // Get the offset parameter from the query string
  const offset = req.query.offset || '';
  console.log("offset: ", offset)
  
  const packageQuery = req.body
  console.log("package query: " + JSON.stringify(packageQuery))

  db.all(`SELECT DISTINCT version, name, id FROM packages WHERE name IN (${packageQuery.map(() => '?').join(', ')})`, packageQuery.map(pkg => pkg.Name), (err, rows) => {
    if (err) {
      console.error(err);
      return;
    } else {
      console.log(rows)
      if (rows.length > 50) {
        res.status(413).json()
      }
      // const filteredRows = rows.map(row => ({ version: row.version, name: row.name }));
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
app.post("/authenticate", function (req, res) {
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
        res.redirect(`/profile`);
      });
    } else {
      //if not found, prompt not found
      console.log("Incorrect username/password: " + username);
      res.render("login", { errorMessage:"Username/password not found"})
    }
  })
});

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
  db.all('SELECT DISTINCT version, id, name FROM packages WHERE name REGEXP ?', `%${query}%`, (err, rows) => {
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
        res.redirect(`/profile`);
      });
    }
  })

});

//user profile page
app.get('/profile', (req, res) => {
  console.log("Logged in user: "+req.username)
  return res.render('profile', {username: req.username})
});

//logout page
app.get('/logout', function(req, res) {
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