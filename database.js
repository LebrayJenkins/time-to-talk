const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./timetotalk.db", (err) => {
    if (err) {
        console.error("Kunde inte öppna databasen:", err.message);
    } else {
        console.log("SQLite-databasen är ansluten.");

        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('student', 'teacher'))
            )
        `, (err) => {
            if (err) {
                console.error("Kunde inte skapa tabellen:", err.message);
            } else {
                console.log("Tabellen 'users' är skapad eller finns redan.");
            }
        });
    }
});

module.exports = db;