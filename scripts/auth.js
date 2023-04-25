const sqlite3 = require('sqlite3');
const dbPath = './data/database.sql';
const db = new sqlite3.Database(dbPath);

// authentication middleware
function auth(req, res, next) {
  console.log("\n[AUTH MIDDLEWARE]")
  console.log("Auth headers: " + JSON.stringify(req.headers))
  console.log("Auth body: " + JSON.stringify(req.body))
  var timestamp = Math.floor(Date.now() / 1000)
  var date = new Date().toLocaleString('en-US', {timeZone: 'America/New_York'})
  console.log("[", date, "]")
  var authHeader = req.headers['x-authorization']
  if (authHeader == undefined) {
    authHeader = req.headers['authorization']
  }
  const hash = authHeader && authHeader.split(' ')[1];
  // console.log("authHeader: "+authHeader)
  console.log("hash: " + hash)

  if (!hash) {
    res.status(400).send()
    return
  }

  // Retrieve user from database based on user hash
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      if (timestamp > row.timestamp + 10*60*60 || row.interactions > 1000) {
      res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
      return
      }
      db.run('UPDATE users SET interactions = interactions + 1 WHERE id = ?', [row.id], err => {
        if (err)
          error(res, err)
        req.username = row.username
        req.isAdmin = row.admin
        req.permissions = row.permissions
        console.log("Authenticated user: " + req.username + "   Admin: " + req.isAdmin + "   Permissions: " +req.permissions)
        console.log("[AUTH COMPLETE] [ SUCCESS ]\n")
        next()
        return
      });
    } else {
      //if not logged in, redirect to login page
      console.log("User hash not found... Redirecting to login")
      console.log("[AUTH COMPLETE] [ FAIL ]\n")
      res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
    }
  })
}

module.exports = auth;