const sqlite3 = require('sqlite3');
const dbPath = './data/database.sql';
const db = new sqlite3.Database(dbPath);

// authentication middleware
function auth(req, res, next) {
    const authHeader = req.headers.authorization
    const hash = authHeader && authHeader.split(' ')[1];
    // console.log("authHeader: "+authHeader)
    console.log("hash: " + hash)

    // Check if user hash is present in cookies
    if (!hash) {
        return res.redirect('/login');
    }

    // Retrieve user from database based on user hash
    db.get('SELECT * FROM users WHERE hash = ?', [hash], (err, row) => {
        if (err) {
            error(res, err)
        } else if (row) {
            req.username = row.username
            req.isAdmin = row.admin
            next()
        } else {
            //if not logged in, redirect to login page
            console.log("User hash not found... Redirecting to login")
            res.send(400).json()
            // res.redirect('/authenticate')
        }
    })
}

module.exports = auth;