var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const cookieParser = require('cookie-parser');
const multer = require('multer');
const AdmZip = require("adm-zip");
const cmd = require('node-cmd');
const path = require('path');
const shell = require('shelljs')
const fs = require('fs');
const setupDatabase = require('./scripts/databaseSetup')
const auth = require('./scripts/auth')
const { Storage } = require('@google-cloud/storage');
const { constants } = require('fs/promises');
const { zip } = require('compressing');
const { OutgoingMessage } = require('http');
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
app.use(express.json({type:'application/json', limit:'50mb'}));
app.use(express.urlencoded({limit: '50mb', extended:true, paramaterLimit:50000}));
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
  console.log("package query: " + JSON.stringify(packageQuery.map(pkg => pkg.Name)))
  console.log(`SELECT * FROM packages WHERE name IN (${packageQuery.map(() => '?').join(', ')})`)

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

//login screen
app.get("/", function (req, res) {
  res.redirect("/login");
});

//login screen
app.get("/authenticate", function (req, res) {
  res.render("login", { errorMessage:""});
});

//handle user login
app.post("/authenticate", function (req, res) {
  var username = req.body.username
  var password = req.body.password
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString()).digest('hex')
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
  if (username == undefined || password == undefined) {
    res.status(400).json()
  }

  value = "bearer " + hash

  //look for user
  db.get('SELECT * FROM users WHERE username = ? AND passHash = ?', [username, passHash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      //if found, update hash and login
      db.run('UPDATE users SET hash = ? WHERE id = ?', [hash, row.id], err => {
        if (err)
          error(res, err)
       res.status(200).json({
        value
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

app.delete("/reset", auth, function (req, res) {
  console.log("body: " + JSON.stringify(req.body))
  var username = req.username
  console.log("Got username: " + username);
  if (username == undefined) {
    res.status(400).json()
  }
  if (req.isAdmin == false) {
    res.status(401).json()
  }

  db.run('DELETE FROM users; DELETE FROM packages;')
  console.log("Reset users and packages")

  var passHash =crypto.createHash('sha256').update('correcthorsebatterystaple123(!__+@**(A’”`;DROP TABLE packages;').digest('hex')

  db.run('INSERT INTO users (username, admin, passHash) VALUES (?, ?, ?)', 
  ['ece461defaultadminuser', true, passHash]
  );
  res.send(200).json()

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

//upload page
app.get('/upload', auth, function(req, res) {
    res.render('upload', { message: '' });
});

function send400(res, err) {
  console.error(err)
  res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
}

//_________________________ BJ _ FINISHED
// DELETE A PACKAGE
app.delete('/package/:id', auth, (req, res) => {
  console.log("\nPackage Deletion Request")

  // get id of package to be deleted
  const id = req.params.id
  if (id == undefined){
    send400(res, "ID undefined")
  } else{
    console.log("Package ID: " + id)

    // get filename of zip to be deleted
    const fileName = id + '.zip'
    console.log("Package Zip File: " + fileName)

    // Check if package id is in the database
    db.get('SELECT * FROM packages WHERE id = ?', id, function(err, row) {
      // if error, return 400
      if (err) {
        send400(res, err)
      } else if (row) {
        // if exists, delete from database and bucket
        console.log('Package with ID: ' + id +', exists in the database.')
        // Execute the deletion query
        db.run('DELETE FROM packages WHERE id = ?', id, (err) => {
          // if error, return 400
          if (err) {
            send400(res, err)
          // else delete package from bucket
          } else {
            console.log('Package with id: ' + id + ', deleted successfully.')

            // Delete the file
            const file = bucket.file(fileName)
            file.delete((err) => {
              // if error return 400
              if (err) {
                send400(res, err)
              // if successful return 200
              } else {
                console.log('Bucket Object: '+ fileName +' deleted successfully.')
                res.status(200).json("Package is deleted.")
              }
            })
          }
        })
      // if file does not exist, return 404
      } else {
        console.log('Package with ID: ' + id + ', does not exist in the database.')
        res.status(404).json("Package does not exist.")
      }
    })
  } 
})

// DOWNLOAD A PACKAGE
app.get('/package/:id', auth, (req, res) => {
  console.log("\nPackage Download Request")

  // get package id
  const id = req.params.id
  console.log("File ID: ", id)

  // get fileName of package
  const fileName = id + '.zip'

  //check to see if package id is defined
  if (id == undefined) {
    send400(res, "ID undefined")
    // Check if package id is in the database
  } else{
    db.get('SELECT * FROM packages WHERE id = ?', id, function(err, row) {
      // if error, return 400
      if (err) {
        send400(res, err)
      // get package json from database
      } else if (row) {
        console.log(JSON.stringify(row))

        // get file from bucket and download to zips folder
        const file = bucket.file(fileName)
        file.download({ destination: './zips/' + fileName }, function(err) {
          // if error, return 400
          if (err) {
            send400(res, err)
          // convert file to base 64 encoded version and send as body in response
          } else {
            console.log('Bucket Object: '+ fileName + ', downloaded to zips folder')
            const zipBuff = fs.readFileSync('./zips/' + fileName)
            const base64Content = zipBuff.toString('base64')
            //console.log(base64Content)
            
            //delete zip files
            fs.rmSync('./zips/' + fileName, {recursive: true, force: true})
            
            //output
            const packageName = row.packageName
            const version = row.version
            const packageID = row.id
            const url = row.url
            const jsprogram = row.JSProgram
            if (url == ""){
              console.log("Package initially uploaded as Content: Sending Response.")
              res.status(200).json({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, JSProgram: jsprogram}})
            } else {
              console.log("Package initially uploaded as URL: Sending Response.")
              res.status(200).json({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, URL: row.url,  JSProgram: jsprogram}})
            }
          }})
      // if package does not exist return 404
      }else{
        console.log('Package with ID: ' + id + ', does not exist in the database.')
        res.status(404).json("Package does not exist.")
      }
    })
  }

})

//_________________________ BJ _ CURRENTLY WORKING ON
// Update a package
app.put('/package/:id', (req, res) => {
  const id = req.params.id;
  
  console.log("ID: ", id)
  console.log("Metadata: ", req.body.metadata)
  console.log("Name: ", req.body.metadata.Name)
  console.log("Version: ", req.body.metadata.Version)
  console.log("ID: ", req.body.metadata.ID)
  console.log("\n")
  const ID = req.body.metadata.ID;
  console.log("Data: ", req.body.data)
  console.log("Content: ", req.body.data.Content)
  console.log("URL: ", req.body.data.URL)
  console.log("JSPROGRAM: ", req.body.data.JSPROGRAM)




  if (id == undefined) {
    send400(res, "ID undefined")
  }
  if (id != ID) {
    res.status(404).json("Package does not exist.")
  }

  res.status(200).json("Version updated")
})

// UPLOAD A PACKAGE
app.post('/package', (req, res) => {
  console.log("\nPackage Upload Request")

  // create a unique id for the current package
  const id = crypto.createHash('sha256').update(Date.now().toString()).digest('hex')

  // get the data from the body of the request
  const data = req.body.data

  // if data is undefined throw an error
  if (data == undefined){
    send400(res, "Data undefined")
  } else {
    // from data get the URL or content
    var url = data.URL
    const content = data.Content
    const jsprogram = data.JSProgram
    if ((jsprogram == undefined) || (jsprogram == "")){
      jsprogram = " "
    }

    // Current Directory is where files will be extracted
    const currentDir = "./zips/" + id 

    // Output File is the file that is zipped and uploaded
    const outputFile = './zips/' + id +'.zip'

    if ((content == undefined) && (url == undefined)){
      send400(res, "Content and URL undefined")
    } else if ((content != undefined) && (url != undefined)){
      send400(res, "Content and URL present")
    } else {
      // if the content method is filled out, perform content extraction
      if (content != undefined){  
        // temporary zip to get zip from content
        tempFile = outputFile

        // gets content into a buffer
        let buff = Buffer.from(content, 'base64')

        // writes content to a zip file
        try {
          fs.writeFileSync(tempFile, buff);   
          console.log("File written successfully");
        } catch(err) {
          send400(res, err)
        }

        // unzip the zip file
        const zip = new AdmZip(tempFile);
        zip.extractAllTo(currentDir, /*overwrite*/ true);
        console.log('Zip extraction complete.');

        // remove the zip file
        fs.rmSync(tempFile, {recursive: true, force: true})
      } else {
        // clone url somewhere on file system
        if (!fs.existsSync(currentDir)){
          fs.mkdirSync(currentDir)
        }

        try {
          // clone repository
          shell.exec('git clone ' + url + " " + currentDir + '/temp/')
          console.log("Repository cloned")
        } catch (err){
          send400(res, err)
        }
      }

      // check if package.json exists
      if (content != ""){
        var subfolders = []
        try {
          const files = fs.readdirSync(currentDir, { withFileTypes: true });
          subfolders = files.filter((file) => file.isDirectory()).map((file) => file.name);
          console.log(subfolders);
        } catch (err) {
          console.log(err);
        }
        packJSONLocation = currentDir + '/'+ subfolders[0] +'/'
      } else {
        packJSONLocation = currentDir + '/temp/'
      }

      try {
        // remove .git
        fs.rmSync(packJSONLocation + ".git", {recursive: true, force: true})
        console.log('Removed .git');
        fs.accessSync(packJSONLocation + 'package.json', );
        console.log('File can be read');
      } catch (err) {
        console.error('No Read access');
      }

      // find url, find name, find version # 
      json = JSON.parse(fs.readFileSync(packJSONLocation + 'package.json', 'utf8'))
      version = json.version
      packageName = json.name
      if (url == ""){
        url = json.repository.url;
      }
      console.log("URL: ", url);
      console.log("Version: ", version);
      console.log("Package Name: ", packageName);

      // check to see if package already exists

      // zip package
      const zip2 = new AdmZip();
      const files = fs.readdirSync(currentDir);
      console.log("Zipping package");

      files.forEach((file) => {
        const filePath = path.join(currentDir, file);
        const fileStats = fs.statSync(filePath);
      
        if (fileStats.isFile()) {
          const fileData = fs.readFileSync(filePath);
          const relativePath = path.relative(currentDir, filePath);
          zip2.addFile(relativePath, fileData);
        } else if (fileStats.isDirectory()) {
          const relativePath = path.relative(currentDir, filePath);
          zip2.addLocalFolder(filePath, relativePath);
        }
      });

      zip2.writeZip(outputFile);
      console.log("Zip created ");

      //run rating algorithm
      //rating = rate(id, url, version) 
      rating = 0

      if (content != ""){
        packageUrl = ''
      } else{
        packageUrl = url
      }
      //insert package into databased
      db.run('INSERT INTO packages (id, packageName, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ? ,?, ?, ?)', [id, packageName, version, packageUrl, 0, rating, 0, " "], function(err) {})

      //upload zip file into bucket storage
      bucket.upload(outputFile, {contentType: 'application/x-zip-compressed'}, function(err, file){
        if (err) {
          console.error(err);
        }
        
        //delete zip files
        fs.rmSync(outputFile, {recursive: true, force: true})
      })

      fs.rmSync(currentDir, {recursive: true, force: true})

      // return status code
      res.status(200).json({id})
    }
  }
})

var server=app.listen(80,function() {});