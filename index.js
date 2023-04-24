var express=require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto')
const multer = require('multer');
const setupDatabase = require('./scripts/databaseSetup')
const auth = require('./scripts/auth')
const { Storage } = require('@google-cloud/storage');
const re2 = require('re2');
const fs = require('fs')
const AdmZip = require('adm-zip')
const path = require('path')
const {exec} = require('child_process')
const shell = require('shelljs');
const { send } = require('process');
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

function send400(res, err) {
  console.error(err);
  res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
}

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

app.post('/packages', auth, (req, res) => {
  console.log("\n[/packages POST]")
  // Get the offset parameter from the query string
  if ((req.permissions & (1 << 1)) == 0) {
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  }

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
      console.log("[/packages POST] [200]\n")
      res.status(200).send(JSON.stringify(rows.slice(0+(50*(offset-1)),50+(50*offset-1))))
}
  })

});

app.put('/package/:id', auth, (req, res) => {
  console.log("\n[/package/id PUT]")
  console.log("\nPackage Update Request")

  if ((req.permissions & (1 << 2)) == 0) {
    console.log("[/package/id PUT] [ 401 ]\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  }

  const id = req.params.id;
  console.log("ID:", id)
  const name = req.body.metadata.Name
  console.log("Package Name: ", name)
  const version = req.body.metadata.Version
  console.log("Version: ", version)
  const reqID = req.body.metadata.ID
  console.log("MetaData ID: ", reqID)
  const content = req.body.data.Content
  var url = req.body.data.URL
  console.log("URL: ", url)
  const fileName = id + '.zip'
  // Current Directory is where files will be extracted
  const currentDir = "./rating/" + id 

  // Output File is the file that is zipped and uploaded
  const outputFile = './rating/' + id +'.zip'
  var jsprogram = req.body.data.JSPROGRAM
  if ((jsprogram == undefined) || (jsprogram == "")){
    jsprogram = " "
  }

  if (id != reqID){
    console.log("[/package/id PUT] [ 400 ] ID mismatch\n")
    send400(res, "NULL")
  } 
  else {
    if ((content == undefined) && (url == undefined)){
      console.log("[/package/id PUT] [ 400 ] No content or url\n")
      send400(res, "Need content or a url")
    }
    else if ((content != undefined) && (url != undefined)){
      console.log("[/package/id PUT] [ 400 ] Content and url\n")
      send400(res, "Got content and a url")
    }
    else{
      const sqlSelect = 'SELECT * FROM packages WHERE id = ? AND name = ? AND version = ?'
      db.get(sqlSelect, [id, name, version], function(err, row) {
        if (err) {
          console.log("[/package/id PUT] [ 400 ] Get package sql error\n")
          send400(res, err)
        } 
        else if (row) {
          console.log(JSON.stringify(row))
          
          //perform update.
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
              console.log("[/package/id PUT] [ 400 ] File write failed\n")
              send400(res, err)
            }

            // unzip the zip file
            const zip = new AdmZip(tempFile);
            zip.extractAllTo(currentDir, /*overwrite*/ true);
            console.log('Zip extraction complete.');

            // remove the zip file
            fs.rmSync(tempFile, {recursive: true, force: true})
          }
          else{
            // clone url somewhere on file system
            if (!fs.existsSync(currentDir)){
              fs.mkdirSync(currentDir)
            }
            try {
              // clone repository
              shell.exec('git clone ' + url + " " + currentDir + '/temp/')
              console.log("Repository cloned")
            } catch (err){
              console.log("[/package/id PUT] [ 400 ] Repo clone failed\n")
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
            } 
            catch (err) {
              console.log("[/package/id PUT] [ 400 ] Package.json get failed\n")
              send400(res, err)
            }
            packageLocation = currentDir + '/'+ subfolders[0] +'/'
          } 
          else {
            packageLocation = currentDir + '/temp/'
          }

          try {
            // remove .git
            fs.rmSync(packageLocation + ".git", {recursive: true, force: true})
            console.log('Removed .git');
            fs.accessSync(packageLocation + 'package.json', );
            console.log('File can be read');
          } catch (err) {
            console.log("[/package/id PUT] [ 400 ] Remove .git failed\n")
            send400(res, err)
          }

          // find url, find name, find version # 
          json = JSON.parse(fs.readFileSync(packageLocation + 'package.json', 'utf8'))
          //version = json.version
          packageName = json.name
          if (url == ""){
            url = json.homepage;
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
          //rating = rate(url, packageLocation, packageJSONLocation) 
          rating = 0

          if (content != ""){
            packageUrl = ''
          } 
          else {
            packageUrl = url
          }

          //insert package into databased
          db.run('UPDATE packages SET name = ?, version = ?, url = ?, stars = ?, rating = ?, downloads = ?, JSProgram = ? WHERE id = ?', [name, version, url, 0, rating, 0, jsprogram, id], function(err) {
            if (err){
              console.log("[/package/id PUT] [ 400 ] Package update failed\n")
              send400(res, err)
            }
            else {
              const file = bucket.file(fileName)
              file.delete((err) => {
                // if error return 400
                if (err) {
                  console.log("[/package/id PUT] [ 400 ] File delete error\n")
                  send400(res, err)
                } 
                else {
                  //upload zip file into bucket storage
                  bucket.upload(outputFile, {contentType: 'application/x-zip-compressed'}, function(err){
                    if (err) {
                      send400(res, err)
                    } else{
                      // return status code
                      console.log('Bucket Object: '+ fileName +' updated successfully.')
                      console.log("[/package/id PUT] [ 200 ]\n")
                      res.status(200).send(JSON.stringify({id}))
                      fs.rmSync(outputFile, {recursive: true, force: true})
                      fs.rmSync(currentDir, {recursive: true, force: true})
                    }
                  })
                }
              })
            }
          })
        }
        else {
          console.log('Package with ID: ' + id + ', does not exist in the database.')
          console.log("[/package/id PUT] [ 400 ] Package ID does not exist\n")
          res.status(404).send(JSON.stringify("Package does not exist."))
        }
      })
    }
  }
  fs.rmSync(outputFile, {recursive: true, force: true})
  fs.rmSync(currentDir, {recursive: true, force: true})
})

app.get('/package/:id', auth, (req, res) => {
  console.log("\n[/package/id GET]")
  if ((req.permissions & (1 << 0)) == 0) { // check permissions
    console.log("[/package/id GET] [ 401 ] Not allowed\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  } 
  const id = req.params.id  // get package id
  console.log("File ID: ", id)
  const fileName = id + '.zip'  // get fileName of package
  if (id == undefined) {  //check to see if package id is defined
    console.log("[/package/id GET] [ 400 ] ID undefined\n")
    res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
  }
  else{  // Check if package id is in the database
    db.get('SELECT * FROM packages WHERE id = ?', id, function(err, row) {
      if (err) { 
        console.log("[/package/id GET] [ 400 ] Could not get package matching ID\n")
        send400(res, err)
      }
      else if (row) { // package found
        db.run('UPDATE packages SET downloads = downloads + 1 WHERE id = ?', id, function(err) {}) // add one to downloads
        console.log(JSON.stringify(row))
        const file = bucket.file(fileName)  // get file from bucket and download to zips folder
        file.download({ destination: './rating/' + fileName }, function(err) { // download file to location
          if (err) {
            console.log("[/package/id GET] [ 400 ] File download error\n")
            console.error(err)
            send400(res, err)
          }
          else {  // convert file to base 64 encoded version and send as body in response
            console.log('Bucket Object: '+ fileName + ', downloaded to zips folder')
            const zipBuff = fs.readFileSync('./rating/' + fileName)
            const base64Content = zipBuff.toString('base64')
            //console.log(base64Content)
            fs.rmSync('./rating/' + fileName, {recursive: true, force: true})  //delete zip files
            //output
            const packageName = row.name
            const version = row.version
            const packageID = row.id
            const url = row.url
            const jsprogram = row.JSProgram
            if (url == ""){ // if uploaded content
              console.log("Package initially uploaded as Content: Sending Response.")
              console.log("[/package/id GET] [ 200 ] " + JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, JSProgram: jsprogram}}) + " \n")
              res.status(200).send(JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, JSProgram: jsprogram}}))
            } else {  // if ingested URL
              console.log("Package initially uploaded as URL: Sending Response.")
              console.log("[/package/id GET] [ 200 ] " + JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, JSProgram: jsprogram}}) + " \n")
              res.status(200).send(JSON.stringify({metadata:{Name: packageName, Version: version, ID: packageID}, data:{Content:base64Content, URL: row.url,  JSProgram: jsprogram}}))
            }
          }
        })
      }
      else{  // if package does not exist return 404
        console.log('Package with ID: ' + id + ', does not exist in the database.')
        console.log("[/package/id GET] [ 404 ] Package does not exist\n")
        res.status(404).send(JSON.stringify("Package does not exist."))
      }
    })
  }
});

app.delete('/package/:id', auth, (req, res) => {
  console.log("\n[/package/id DELETE]")
  if ((req.permissions & (1 << 2)) == 0) { // check permissions
    console.log("[/package/id DELETE] [ 401 ] Not allowed\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  }
  const id = req.params.id // get package id
  console.log("Package ID: " + id)
  if (id == undefined){  // check for valid id
    console.log("[/package/id DELETE] [ 400 ] ID undefined\n")
    send400(res, err)
  } 
  else{
    const fileName = id + '.zip'  // get filename of zip to be deleted
    console.log("Package Zip File: " + fileName)
    db.get('SELECT * FROM packages WHERE id = ?', id, function(err, row) {  // Check if package id is in the database
      // if error, return 400
      if (err) {
        console.error(err)
        console.log("[/package/id DELETE] [ 400 ] Could not get package matching ID\n")
        send400(res, err)
      // if exists, delete from database and bucket
      } else if (row) {
        console.log('Package with ID: ' + id +', exists in the database.')
        db.run('DELETE FROM packages WHERE id = ?', id, (err) => { // Execute the deletion query
          if (err) {
            console.error(err)
            console.log("[/package/id DELETE] [ 400 ] Deletion error\n")
            send400(res, err)
          // else delete package from bucket
          } else {
            console.log('Package with id: ' + id + ', deleted successfully.')
            const file = bucket.file(fileName)  // file in bucket
            file.delete((err) => {  // Delete the file
              if (err) {
                console.error(err)
                console.log("[/package/id DELETE] [ 400 ] Bucket delete error\n")
                send400(res, err)
              } else { //successful deletion
                console.log('Bucket Object: '+ fileName +' deleted successfully.')
                console.log("[/package/id DELETE] [ 200 ] \n")
                res.status(200).send(JSON.stringify("Package is deleted."))
              }
            })
          }
        })
      }
      else {  // if file does not exist, return 404
        console.log('Package with ID: ' + id + ', does not exist in the database.')
        console.log("[/package/id GET] [ 404 ] Package does not exist\n")
        res.status(404).send(JSON.stringify("Package does not exist."))
      }
    })
  } 

});

app.get('/package/:id/rate', auth, (req, res) => {
  console.log("\n[/package/id/rate GET]")

  const id = req.params.id // get id from request
  console.log("File ID: ", id) 
  if ((req.permissions & (1 << 2)) == 0) { // permissions denied
    console.log("[/package/id/rate GET] [ 401 ] Not allowed\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  }
  else if (id == undefined) { // id is undefined?
    console.log("Error with id.")
    res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
  } 
  else { // search for package
    db.get('SELECT * FROM packages WHERE id = ?', id, function(err, row) {
      if (err) { send400(res, err)} // error searching database
      else if (row) {  // package found in database
        const rating = JSON.parse(row.rating)
        console.log("\nRating Algorithm Results")
        console.log("NetScore: ", rating.NetScore, "\nRampUp: ", rating.RampUp, "\nCorrectness: ", rating.Correctness, "\nBusFactor: ", rating.BusFactor, "\nResponsiveMaintainer: ", rating.ResponsiveMaintainer, "\nGoodPinningPractice: ", rating.GoodPinningPractice, "\nPullRequest: ", rating.PullRequest, "\nLicenseScore: ", rating.LicenseScore, "\n")
        if ((rating.BusFactor == -1) || (rating.Correctness == -1) || (rating.RampUp == -1) || (rating.ResponsiveMaintainer == -1) || (rating.LicenseScore == -1) || (rating.GoodPinningPractice == -1) || (rating.PullRequest == -1) || (rating.NetScore == -1)){  // error in rating
          console.log("At least one metric scored -1.")
          res.status(500).send(JSON.stringify("The package rating system choked on at least one of the metrics."))
        } 
        else {  // package rating found, return
          console.log("Returning rating data (proper request).")
          res.status(200).send(JSON.stringify({"BusFactor":rating.BusFactor, "Correctness": rating.Correctness, "RampUp":rating.RampUp, "ResponsiveMaintainer": rating.ResponsiveMaintainer, "LicenseScore": rating.LicenseScore, "GoodPinningPractice":rating.GoodPinningPractice, "PullRequest":rating.PullRequest, "NetScore":rating.NetScore}))
        }
      } 
      else{  // package does not exist
        console.log("Package does not exist.")
        res.status(404).send(JSON.stringify("Package does not exist."))
      }
    })
  }
});

app.post('/package', auth, (req, res) => {
  console.log("\n[/package POST]")
  if ((req.permissions & (1 << 2)) == 0) { /// check for permission
    console.log("[/package POST] [ 401 ] Not allowed\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
  } 
  else { // try to upload package
    const id = crypto.createHash('sha256').update(Date.now().toString()).digest('hex')  // create a unique id for the current package
    const data = req.body.data    // get the data from the body of the request
    console.log("Data:", data)
    if (data == undefined){    // if data is undefined throw an error
      console.log("[/package POST] [ 401 ] Data undefined\n")
      res.status(400).send(JSON.stringify("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid."))
    } else {
      const currentDir = "./rating/" + id  // where files will be extracted
      const outputFile = './rating/' + id +'.zip'  // file that is zipped and uploaded
      var url = data.URL  // from data get the URL
      const content = data.Content  // from data get the content
      var jsprogram = data.JSProgram
      if ((jsprogram == undefined) || (jsprogram == "")){
        jsprogram = " "
      }
      if ((content == undefined || content == '') && (url == undefined || url == '')){ // both are undefined
        console.log("[/package POST] [ 400 ] Got content and url\n")
        res.status(400).send(JSON.stringify("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid."))
      } 
      else if ((content != undefined && content != '') && (url != undefined && url != '')){ // both are defined
        console.log("[/package POST] [ 400 ] Got no content or url\n")
        res.status(400).send(JSON.stringify("There is missing field(s) in the PackageData/AuthenticationToken or it is formed improperly (e.g. Content and URL are both set), or the AuthenticationToken is invalid."))
      } 
      else { // one is defined
        if (content != undefined && content != ''){  // content is defined
          url = ""
          tempFile = outputFile  // temporary zip to get zip from content
          let buff = Buffer.from(content, 'base64')  // gets content into a buffer
          try {  // writes content to a zip file
            fs.writeFileSync(tempFile, buff)
            console.log("File written successfully")
          } catch(err) {
            console.log("[/package POST] [ 400 ] File write failed\n")
            send400(res, err)
            return
          }
          const zip = new AdmZip(tempFile)
          zip.extractAllTo(currentDir, /*overwrite*/ true)  // unzip the zip file
          console.log('Zip extraction complete.')
          fs.rmSync(tempFile, {recursive: true, force: true})  // remove the zip file
        } 
        else { // url is defined
          if (!fs.existsSync(currentDir)){  // makes directory
            fs.mkdirSync(currentDir)
          }
          try {  // clone repository
            shell.exec('git clone ' + url + " " + currentDir + '/temp/')            
            console.log("Repository cloned")
          } catch (err){
            console.log("[/package POST] [ 400 ] Clone failed\n")
            send400(res, err)
            return
          }
      }
        //gets location of repository (assumes package.json should be main directory)
        if (content != undefined && content != ''){  // if content is inputed
          var subfolders = []
          try { // gets subfolder name if the input is not a url
            const files = fs.readdirSync(currentDir, { withFileTypes: true })
            subfolders = files.filter((file) => file.isDirectory()).map((file) => file.name)
            console.log(subfolders)
          } catch (err) {
            console.log(err)
          }
          packageLocation = id + '/'+ subfolders[0] +'/'
        } 
        else { // if url is inputted
          packageLocation = id + '/temp/'
        }
        // remove .git and access package.json
        try {
          fs.rmSync('./rating/' + packageLocation + ".git", {recursive: true, force: true})
          console.log('Removed .git')
          fs.accessSync('./rating/' + packageLocation + 'package.json', )
          console.log('Package.json found')
        } catch (err) {
          console.log('Package.json not found')
        }

        // find url, find name, find version # 
        json = JSON.parse(fs.readFileSync('./rating/' + packageLocation + 'package.json', 'utf8'))
        version = json.version
        packageName = json.name
        if (url == undefined || url == ''){ // if url not defined, find url
          url = json.homepage
        }
        url = url.replace(".git","") // fixes .git urls
        url = url.replace("git:","https:") //fixes git: urls
        url = url.replace("#readme","")
        if (url == ""){
          url = json.repository.url;
        }
        console.log("URL: ", url, "\nVersion: ", version, "\nPackage Name: ", packageName)

        // zip package
        const zip2 = new AdmZip()
        const files = fs.readdirSync(currentDir)
        console.log("Zipping package")
        files.forEach((file) => {
          const filePath = path.join(currentDir, file)
          const fileStats = fs.statSync(filePath)
        
          if (fileStats.isFile()) {
            const fileData = fs.readFileSync(filePath)
            const relativePath = path.relative(currentDir, filePath)
            zip2.addFile(relativePath, fileData)
          } else if (fileStats.isDirectory()) {
            const relativePath = path.relative(currentDir, filePath)
            zip2.addLocalFolder(filePath, relativePath)
          }
        })
        zip2.writeZip(outputFile) // wrote zip
        console.log("Zip created ")

        //run rating algorithm
        process.chdir('./rating')
        console.log("Rating Algorithm running.")
        exec('go run main.go ' + url + ' ' + packageLocation, (err, stdout, stderr) => {
          if (err){ // rating is -1
            console.error(err)
            rating = -1
          }
          else if (stdout){ // properly gets rating
            rating = JSON.parse(stdout)
            console.log("NetScore: ", rating.NetScore, "\nRampUp: ", rating.RampUp, "\nCorrectness: ", rating.Correctness, "\nBusFactor: ", rating.BusFactor, "\nResponsiveMaintainer: ", rating.ResponsiveMaintainer, "\nGoodPinningPractice: ", rating.GoodPinningPractice, "\nPullRequest: ", rating.PullRequest, "\nLicenseScore: ", rating.LicenseScore, "\n")
            rating = JSON.stringify(rating)
          } 
          else if (stderr){ // error, rating is -1
            console.log(stderr)
            rating = -1
          }
          if (content != undefined && content != ''){ // if content is not empty then url is undefined
            packageUrl = ""
          } else{
            packageUrl = url
          }
          if ((url != "") && ((rating.BusFactor < 0.5) || (rating.Correctness < 0.5) || (rating.RampUp < 0.5) || (rating.ResponsiveMaintainer < 0.5) || (rating.LicenseScore < 0.5))){  // error in rating
            console.log("[/package POST] [ 424 ] Package does not qualify for upload\n")
            res.status(424).send(JSON.stringify("Package is not uploaded due to the disqualified rating.")) 
          } else{
            db.get('SELECT * FROM packages WHERE name = ?', packageName, function(err, row) {
              if (err) {
                send400(res, err)
              }
              else if (row){
                console.log("Package exists already.")
                console.log("[/package POST] [ 400 ] Package already exists\n")
                res.status(409).send(JSON.stringify("Package exists already.")) 
              } 
              else{
                console.log("Inserting package into database.") //insert package into databased
                db.run('INSERT INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ? ,?, ?, ?)', [id, packageName, version, packageUrl, 0, rating, 0, " "], function(err) {})    
                process.chdir('..') // move directories
                //upload zip file into bucket storage
                bucket.upload(outputFile, {contentType: 'application/x-zip-compressed'}, function(err, file){
                  if (err) {
                    console.error(err)
                    console.log("File not uploaded to bucket.")
                  } 
                  else{
                    console.log("File uploaded to bucket.")
                  }
                  fs.rmSync(outputFile, {recursive: true, force: true})  //delete zip files
                })
                fs.rmSync(currentDir, {recursive: true, force: true}) // clear directory
                if (url != ""){
                  const fileName = id + '.zip'  // get filename of zip to be deleted
                  const zipBuff = fs.readFileSync('./rating/' + fileName)
                  const base64Content = zipBuff.toString('base64')
                  console.log("[/package POST] [ 201 ]\n")
                  res.status(201).send(JSON.stringify({"metadata":{"Name":packageName, "Version":version, "ID":id}, "data":{"URL":data.url, "Content":base64Content, "JSProgram":data.JSProgam}}))  // return status code
                }
                else{
                  console.log("[/package POST] [ 201 ]\n")
                  res.status(201).send(JSON.stringify({"metadata":{"Name":packageName, "Version":version, "ID":id}, "data":{"Content":data.Content, "JSProgram":data.JSProgam}}))  // return status code
                } 
              }
            })
          }
        })
      }
    }
  }
});

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
  console.log("\n[/authenticate PUT]")
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  var password = req.body.Secret.password
  var isAdmin  = req.body.User.isAdmin
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString()).digest('hex')
  var timestamp = Math.floor(Date.now() / 1000)
  console.log("Got username: " + username);
  console.log("Got password: " + password);
  console.log("Got admin: " + isAdmin);
  console.log("Login hash: " + hash)
  if (username == undefined || username == "" || password == undefined || password == "") {
    console.log("[/authenticate PUT] [ 400 ] No username or password\n")
    res.status(400).send(JSON.stringify("Please provide a username and password"))
    return;
  }

  authorization = "bearer " + hash

  //look for user
  db.get('SELECT * FROM users WHERE username = ? AND passHash = ?', [username, passHash], (err, row) => {
    if (err) {
      console.log("[/authenticate PUT] [ 400 ] Error looking up user\n")
      error(res, err)
    } else if (row) {
      //if found, update hash and login
      db.run('UPDATE users SET hash = ?, timestamp = ? WHERE id = ?', [hash, timestamp, row.id], err => {
        if (err) {
          console.log("[/authenticate PUT] [ 400 ] Error updating hash\n")
          error(res, err)
        }
        console.log("Authentication success " + username + "\n");
        console.log("[/authenticate PUT] [ 200 ]\n")
        res.status(200).send(JSON.stringify(authorization))
      });
    } else {
      //if not found, prompt not found
      console.log("Incorrect username/password: " + username + "\n");
      console.log("[/authenticate PUT] [ 400 ] User not found\n")
      res.status(401).send(JSON.stringify())
    }
  })
});

app.put("/register", auth, (req, res) => {
  console.log("\n[/register PUT]")
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  var password = req.body.Secret.password
  var isAdmin  = req.body.User.isAdmin
  var permissions  = req.body.User.permissions
  //allow download and search by default
  if (permissions == undefined) { permissions = 3 }
  var passHash =crypto.createHash('sha256').update(password).digest('hex')
  var hash = crypto.createHash('sha256').update(username + password + Date.now().toString()).digest('hex')
  console.log("Got username: " + username);
  console.log("Got admin: " + isAdmin);
  console.log("Got permissions: " + permissions);
  console.log("Login hash: " + hash)
  if (req.isAdmin != true) {
    console.log("[/register PUT] [ 401 ] Not admin\n")
    res.status(401).send(JSON.stringify("Must be admin to complete this action"))
    return;
  }

  if (username == undefined || username == "" || password == undefined || password == "") {
    console.log("[/register PUT] [ 400 ] No username or password\n")
    res.status(400).send(JSON.stringify("Please provide a username and password"))
    return;
  }
  
  //validate the password
  if (validatePassword(password) == 0) {
    console.log("[/register PUT] [ 400 ] Invalid password\n")
    res.status(400).send(JSON.stringify("Password must be minimum 8 characters with upper and lower case, and at least one number and special character"))
    return;
  }

  value = "bearer " + hash
  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.log("[/register PUT] [ 400 ] Error looking for users\n")
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      console.log("[/register PUT] [ 400 ] Account exists\n")
      res.status(400).send(JSON.stringify("Account already exists, please login or choose a different username"))
    } else {
      //if new username, create new user
      db.run('INSERT INTO users (username, passHash, hash, admin, permissions) VALUES (?, ?, ?, ?, ?)', [username, passHash, hash, isAdmin, permissions], function(err) {
        if (err) {
          console.log("[/register PUT] [ 400 ] Insert error\n")
          error(res, err)
        }
        console.log("[/register PUT] [ 200 ] Registered new user\n")
        res.status(200).send(JSON.stringify({value}))
      });
    }
  })

});

app.delete("/register", auth, (req, res) => {
  console.log("\n[/register DELETE]")
  console.log("body: " + JSON.stringify(req.body))
  var username = req.body.User.name
  console.log("Got username: " + username);
  if (req.isAdmin != true && req.username != username) {
    console.log("[/register DELETE] [ 401 ] Not user or admin\n")
    res.status(401).send(JSON.stringify("Must be admin or this user to complete this action"))
    return;
  }

  if (username == undefined || username == "") {
    console.log("[/register DELETE] [ 400 ] No username provided\n")
    res.status(400).send(JSON.stringify("Please provide a username"))
    return;
  }

  //check if username exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.log("[/register DELETE] [ 400 ] Error lookup username\n")
      error(res, err)
    } else if (row) {
      //if exists, promp login or different username
      db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
        if (err) {
        console.log("[/register DELETE] [ 400 ] Error delete user\n")
        error(res, err)
        } else {
          console.log("[/register DELETE] [ 200 ] \n")
          res.status(200).send(JSON.stringify("Deleted user"))
        }
      });
    } else {
      console.log("[/register DELETE] [ 400 ] User does not exist\n")
      res.status(400).send(JSON.stringify("Account does not exist, please choose a different username"))
    }
  })

});

app.delete("/reset", auth, (req, res) => {
  console.log("\n[/reset DELETE]")

  if (req.isAdmin != true) {
    console.log("[/reset DELETE] [ 401 ] Not admin\n")
    res.status(401).send(JSON.stringify("You do not have permission to reset the registry."))
    return;
  }

  
  db.serialize(() => {
    bucket.deleteFiles()
    .then(() => {
      console.log(`All files deleted from bucket ${bucketName}.\n`)
    })
    .catch((err) => {
      console.log("[/reset DELETE] [ 400 ] Error clearing bucket\n")
      error(res, err)
    })
    db.run('DELETE FROM users;');
    db.run('DELETE FROM packages;');
    var passHash =crypto.createHash('sha256').update('correcthorsebatterystaple123(!__+@**(A’”`;DROP TABLE packages;').digest('hex')
    db.run('INSERT OR IGNORE INTO users (username, admin, permissions, passHash) VALUES (?, ?, ?, ?)', 
    ['ece30861defaultadminuser', true, 7, passHash]);
    console.log("[/reset DELETE] [ 200 ]\n")
  })

});

//search page
app.post('/package/byRegEx', auth, (req, res) => {
  console.log("\n[/regex POST]")
  if ((req.permissions & (1 << 1)) == 0) {
    console.log("[/regex POST] [ 401 ] Not allowed\n")
    res.status(401).send(JSON.stringify("You do not have permission for this action."))
    return
  }

  console.log("body: " + JSON.stringify(req.body))
  const query = req.body.regex
  console.log(query)
  
  const regex = new re2(query)

  // Get all package names
  db.all("SELECT DISTINCT name FROM packages", (err, rows) => {
    if (err) {
      console.error(err.message)
      console.log("[/regex POST] [ 400 ] Error getting packages\n")
      error(res, err)
      return
    }

    // Filter package names by regex
    console.log(rows)
    const matchedNames = rows.filter(row => regex.test(row.name)).map(row => row.name)
    console.log(matchedNames)

    // Get package details for matched names
    db.all(`SELECT DISTINCT name, version FROM Packages WHERE Name IN (${matchedNames.map(() => '?').join(',')})`, matchedNames, (err, rows) => {
      if (err) {
        console.log("[/regex POST] [ 400 ] Error searching with regex\n")
        error(res, err)
        return
      }
      console.log("[/regex POST] [ 200 ]\n")
      res.status(200).send(JSON.stringify(rows))
    })
  })

});

//user profile page
app.get('/profile', (req, res) => {
  console.log("Rendering /profile")
  return res.render('profile', {username: req.username})
});


var server=app.listen(80,function() {});
