const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./timetotalk.db", (err) => {
    if (err) {
        console.error("Kunde inte öppna databasen:", err.message);
    } else {
        console.log("SQLite-databasen är ansluten.");
    }
});

module.exports = db;