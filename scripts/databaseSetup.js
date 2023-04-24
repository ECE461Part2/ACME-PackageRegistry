const sqlite3 = require('sqlite3');
const crypto = require('crypto')

function setupDatabase() {
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
  /*Permission breakdown:
    level | upload | search | download
      0        0        0         0
      1        0        0         1
      2        0        1         0
      3        0        1         1
      4        1        0         0
      5        1        0         1
      6        1        1         0
      7        1        1         1
  */
 db.serialize(() => {
   db.run(`
     CREATE TABLE IF NOT EXISTS packages (
       key INTEGER PRIMARY KEY,
       id TEXT NOT NULL,
       name TEXT NOT NULL,
       version TEXT NOT NULL,
       stars INTEGER DEFAULT 0,
       url TEXT,
       rating JSON,
       JSProgram TEXT,
       downloads INTEGER DEFAULT 0
     );
   `)
 
   db.run(`
     CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY,
       username TEXT NOT NULL,
       passHash TEXT NOT NULL,
       hash TEXT UNIQUE,
       timestamp INTEGER,
       interactions INTEGER DEFAULT 0,
       permissions INTEGER,
       admin INTEGER DEFAULT 0
     );
   `)
 
   var passHash =crypto.createHash('sha256').update('correcthorsebatterystaple123(!__+@**(A’”`;DROP TABLE packages;').digest('hex')
 
   db.run('INSERT OR IGNORE INTO users (username, admin, permissions, passHash) VALUES (?, ?, ?, ?)', 
   ['ece30861defaultadminuser', true, 7, passHash]
   );
 
   db.run('INSERT OR IGNORE INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["underscore", "Underscore", "1.6.9", '', 0, 0, 0, " "])
   db.run('INSERT OR IGNORE INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["lodash", "Lodash", "1.1.0", '', 0, 0, 0, " "])
   
 })
  
  return db
}

module.exports = setupDatabase;