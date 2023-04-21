const sqlite3 = require('sqlite3');
const dbPath = './data/database.sql';
const db = new sqlite3.Database(dbPath);

// authentication middleware
function auth(req, res, next) {
  console.log("auth body: " + JSON.stringify(req.headers))
  var timestamp = Math.floor(Date.now() / 1000)
  const authHeader = req.headers.authorization
  const hash = authHeader && authHeader.split(' ')[1];
  // console.log("authHeader: "+authHeader)
  console.log("hash: " + hash)

  if (!hash) {
    res.send(400).json()
    return
  }

  // Retrieve user from database based on user hash
  db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
    if (err) {
      error(res, err)
    } else if (row) {
      if (timestamp > row.timestamp + 10*60*60 || row.interactions > 1000) {
        res.status(400).json("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.")
        return
      }
      db.run('UPDATE users SET interactions = interactions + 1 WHERE id = ?', [row.id], err => {
        if (err)
          error(res, err)
        req.username = row.username
        req.isAdmin = row.admin
        console.log("Authenticated user " + req.username)
        next()
        return
      });
    } else {
      //if not logged in, redirect to login page
      console.log("User hash not found... Redirecting to login")
      res.status(400).send(JSON.stringify("There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid."))
    }
  })
}

module.exports = auth;