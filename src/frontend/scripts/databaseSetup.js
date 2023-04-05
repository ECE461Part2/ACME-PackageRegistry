const sqlite3 = require('sqlite3');

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
        admin INTEGER DEFAULT 0
      )
    `);
    
    //create package database
    db.run(`
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY,
        nickname TEXT NOT NULL,
        filename TEXT NOT NULL,
        stars INTEGER DEFAULT 0,
        downloads INTEGER DEFAULT 0
      )
    `);
    
    return db
}

module.exports = setupDatabase;