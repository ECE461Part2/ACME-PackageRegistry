var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const multer = require('multer');
const setupDatabase = require('./scripts/databaseSetup')
const auth = require('./scripts/auth')
const { Storage } = require('@google-cloud/storage');
const re2 = require('re2');
if (process.env.BUCKET_CREDENTIALS == undefined) {
  console.log("Getting BUCKET_CREDENTIALS")
  require('dotenv').config({path:__dirname+'/./../../../.env'})
}
console.log("BUCKET_CREDENTIALS: ", process.env.BUCKET_CREDENTIALS)
console.log("GITHUB_TOKEN: ", process.env.GITHUB_TOKEN)

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

app.put('/package/:id', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

});

app.get('/package/:id', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

    console.log("\nPackage Download Request")

  // get package id
  const id = req.params.id
  console.log("File ID: ", id)

  // get fileName of package
  const fileName = id + '.zip'

  //check to see if package id is defined
  if (id == undefined) {
    res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
    // Check if package id is in the database
  } else{
    const sqlSelect = 'SELECT * FROM packages WHERE id = ?'
    db.get(sqlSelect, id, function(err, row) {
      // if error, return 400
      if (err) {
        console.error(err)
        res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
      // get package json from database
      } else if (row) {
        db.run('UPDATE packages SET downloads = downloads + 1 WHERE id = ?', [id], function(err) {})
        console.log(JSON.stringify(row))

        // get file from bucket and download to zips folder
        const file = bucket.file(fileName)
        file.download({ destination: './rating/' + fileName }, function(err) {
          // if error, return 400
          if (err) {
            console.error(err)
            res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
          // convert file to base 64 encoded version and send as body in response
          } else {
            console.log('Bucket Object: '+ fileName + ', downloaded to zips folder')
            const zipBuff = fs.readFileSync('./rating/' + fileName)
            const base64Content = zipBuff.toString('base64')
            //console.log(base64Content)
            
            //delete zip files
            fs.rmSync('./rating/' + fileName, {recursive: true, force: true})
            
            //output
            const packageName = row.name
            const version = row.version
            const packageID = row.id
            const url = row.url
            const jsprogram = row.JSProgram
            if (url == ""){
              console.log("Package initially uploaded as Content: Sending Response.")
              res.status(200).send(JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, JSProgram: jsprogram}}));
            } else {
              console.log("Package initially uploaded as URL: Sending Response.")
              res.status(200).send(JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, URL: row.url,  JSProgram: jsprogram}}));
            }
          }})
      // if package does not exist return 404
      }else{
        console.log('Package with ID: ' + id + ', does not exist in the database.')
        res.status(404).json("Package does not exist.")
      }
    })
  }
});

app.delete('/package/:id', auth, (req, res) => {
  console.log("\nPackage Deletion Request")

  // get id of package to be deleted
  const id = req.params.id
  if (id == undefined){
    res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
  } else{
    console.log("Package ID: " + id)

    // get filename of zip to be deleted
    const fileName = id + '.zip'
    console.log("Package Zip File: " + fileName)

    // Check if package id is in the database
    const sql1 = 'SELECT * FROM packages WHERE id = ?'
    db.get(sql1, id, function(err, row) {
      // if error, return 400
      if (err) {
        console.error(err)
        res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
      // if exists, delete from database and bucket
      } else if (row) {
        console.log('Package with ID: ' + id +', exists in the database.')
        
        // delete package from database
        const sql = 'DELETE FROM packages WHERE id = ?'

        // Execute the deletion query
        db.run(sql, id, (err) => {
          // if error, return 400
          if (err) {
            console.error(err)
            res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")

          // else delete package from bucket
          } else {
            console.log('Package with id: ' + id + ', deleted successfully.')

            // file in bucket
            const file = bucket.file(fileName)

            // Delete the file
            file.delete((err) => {
              // if error return 400
              if (err) {
                console.error(err)
                res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
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

});

app.get('/package/:id/rate', auth, (req, res) => {
  // const packageQuery = req.body
  // console.log("package query: " + JSON.stringify(packageQuery))

  res.status(200).json({"you get":"rated your package bro"})

});

app.post('/package', auth, (req, res) => {
  console.log("\nPackage Upload Request")

  // create a unique id for the current package
  const id = crypto.createHash('sha256').update(Date.now().toString()).digest('hex')

  // get the data from the body of the request
  const data = req.body.data

  // if data is undefined throw an error
  if (data == undefined){
    res.status(400).json("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid.")
  } else {
    // from data get the URL or content
    var url = data.URL
    const content = data.Content
    var jsprogram = data.JSProgram
    if ((jsprogram == undefined) || (jsprogram == "")){
      jsprogram = " "
    }

    // Current Directory is where files will be extracted
    const currentDir = "./rating/" + id 

    // Output File is the file that is zipped and uploaded
    const outputFile = './rating/' + id +'.zip'

    if ((content == undefined) && (url == undefined)){
      res.status(400).json("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid.")
    } 
    else if ((content != undefined) && (url != undefined)){
      res.status(400).json("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid.")
    } 
    else {
      // if the content method is filled out, perform content extraction
      if (content != undefined){  
        url = ""
        // temporary zip to get zip from content
        tempFile = outputFile

        // gets content into a buffer
        let buff = Buffer.from(content, 'base64')

        // writes content to a zip file
        try {
          fs.writeFileSync(tempFile, buff);   
          console.log("File written successfully");
        } catch(err) {
          res.status(400).json("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid.")
          console.error(err);
        }

        // unzip the zip file
        const zip = new AdmZip(tempFile);
        zip.extractAllTo(currentDir, /*overwrite*/ true);
        console.log('Zip extraction complete.');

        // remove the zip file
        fs.rmSync(tempFile, {recursive: true, force: true})
      } 
      else {
        // clone url somewhere on file system
        if (!fs.existsSync(currentDir)){
          fs.mkdirSync(currentDir)
        }
        try {
          // GET FILEPATH

          // clone repository
          shell.exec('git clone ' + url + " " + currentDir + '/temp/')
          console.log("Repository cloned")
        } catch (err){
          console.error(err);
          res.status(400).json("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid.")
        }
    }

      // check if package.json exists
      console.log("Repository")
      if (content != ""){
        var subfolders = []
        try {
          const files = fs.readdirSync(currentDir, { withFileTypes: true });
          subfolders = files.filter((file) => file.isDirectory()).map((file) => file.name);
          console.log(subfolders);
        } catch (err) {
          console.log(err);
        }
        packageLocation = id + '/'+ subfolders[0] +'/'
      } else {
        packageLocation = id + '/temp/'
      }

      try {
        // remove .git
        fs.rmSync('./rating/' + packageLocation + ".git", {recursive: true, force: true})
        console.log('Removed .git');
        fs.accessSync('./rating/' + packageLocation + 'package.json', );
        console.log('File can be read');
      } catch (err) {
        console.error('No Read access');
      }

      // find url, find name, find version # 
      json = JSON.parse(fs.readFileSync('./rating/' + packageLocation + 'package.json', 'utf8'))
      version = json.version
      packageName = json.name
      if (url == ""){
        url = json.repository.url;
      }
      url = url.replace(".git","")
      url = url.replace("git:","https:")
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
      process.chdir('./rating');
      console.log("Rating Algorithm running.")
      exec('go run main.go ' + url + ' ' + packageLocation, (err, stdout, stderr) => {
        if (err){
          console.error(err)
          rating = -1
        }
        else if (stdout){
          rating = JSON.parse(stdout)
          console.log("\nRating Algorithm Results")
          console.log("NetScore: ", rating.NetScore)
          console.log("RampUp: ", rating.RampUp)
          console.log("Correctness: ", rating.Correctness)
          console.log("BusFactor: ", rating.BusFactor)
          console.log("ResponsiveMaintainer: ", rating.ResponsiveMaintainer)
          console.log("GoodPinningPractice: ", rating.GoodPinningPractice)
          console.log("PullRequest: ", rating.PullRequest)
          console.log("LicenseScore: ", rating.LicenseScore)
          console.log("\n")
        } else if (stderr){
          console.log(stderr)
          rating = -1
        }

        if (content != ""){
          packageUrl = ''
        } else{
          packageUrl = url
        }
        console.log("Inserting package into database.")
  
        //insert package into databased
        db.run('INSERT INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ? ,?, ?, ?)', [id, packageName, version, packageUrl, 0, rating, 0, " "], function(err) {})    
      
        process.chdir('..')
  
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
      })

  }}
})

//login screen
app.get("/", (req, res) => {
  res.redirect("/authenticate");
});

//login screen
app.get("/authenticate", (req, res) => {
  res.render("authenticate");
});

//handle user login
app.put("/authenticate", (req, res) => {
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

app.put("/register", auth, (req, res) => {
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

app.delete("/register", auth, (req, res) => {
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

app.delete("/reset", auth, (req, res) => {
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
  const query = req.body.regex
  console.log(query)
  
  const regex = new re2(query)

  // Get all package names
  db.all("SELECT DISTINCT name FROM packages", (err, rows) => {
    if (err) {
      console.error(err.message)
      return
    }

    // Filter package names by regex
    console.log(rows)
    const matchedNames = rows.filter(row => regex.test(row.name)).map(row => row.name)
    console.log(matchedNames)

    // Get package details for matched names
    db.all(`SELECT DISTINCT name, version FROM Packages WHERE Name IN (${matchedNames.map(() => '?').join(',')})`, matchedNames, (err, rows) => {
      if (err) {
        error(res, err)
        return
      }
      res.status(200).send(JSON.stringify(rows))
    })
  })

});

//user profile page
app.get('/profile', (req, res) => {
  console.log("Logged in user: "+req.username)
  return res.render('profile', {username: req.username})
});


var server=app.listen(80,function() {});
