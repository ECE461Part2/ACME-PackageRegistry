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
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        passHash TEXT NOT NULL,
        hash TEXT UNIQUE,
        timestamp INTEGER,
        interactions INTEGER DEFAULT 0,
        admin INTEGER DEFAULT 0
      )
    `), function(err) {
      //create package database
      db.run(`
        CREATE TABLE IF NOT EXISTS packages (
          key INTEGER PRIMARY KEY,
          id TEXT NOT NULL,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          stars INTEGER DEFAULT 0,
          url TEXT,
          rating INTEGER DEFAULT 0,
          JSProgram TEXT,
          downloads INTEGER DEFAULT 0
        )
      `), function(err) {
        var passHash =crypto.createHash('sha256').update('correcthorsebatterystaple123(!__+@**(A’”`;DROP TABLE packages;').digest('hex')
    
        db.run('INSERT INTO users (username, admin, passHash) VALUES (?, ?, ?)', 
        ['ece461defaultadminuser', true, passHash]
        );
    
        db.run('INSERT INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["underscore", "Underscore", "1.6.9", '', 0, 0, 0, " "])
        db.run('INSERT INTO packages (id, name, version, url, stars, rating, downloads, JSProgram) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["lodash", "Lodash", "1.1.0", '', 0, 0, 0, " "])
        
        return db
  
      };

    }
    
}

module.exports = setupDatabase;