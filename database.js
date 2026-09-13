const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./timetotalk.db", (err) => {
    if (err) {
        console.error("Kunde inte öppna databasen:", err.message);
    } else {
        console.log("SQLite-databasen är ansluten.");
        
        //aktivera foregin keys
        db.run("PRAGMA foreign_keys = ON");

        //skapa users-tabellen
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

        //skapa available_times-tabellen
        db.run(`
            CREATE TABLE IF NOT EXISTS available_times (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                activity TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available',
                FOREIGN KEY (teacher_id) REFERENCES users (id)
            
            )
        `, (err) => {
            if (err) {
                console.error("Kunde inte skapa available_times-tabellen:", err.message);
            } else {
                console.log("Tabellen 'available_times' är skapad eller finns redan.");
            }
        });

        //skapa bookings-tabellen
        db.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,   
                available_time_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'booked',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (available_time_id) REFERENCES available_times (id),
                FOREIGN KEY (student_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error("Kunde inte skapa bookings-tabellen:", err.message);
            } else {
                console.log("Tabellen 'bookings' är skapad eller finns redan.");
            }

        });
    }
});        

function createUser(name, email, password, role, callback) {
        const sql = `
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [name, email, password, role], function (err) {
        if (err) {
            callback(err);
            return;
        }

        callback(null, {
            id: this.lastID,
            name: name,
            email: email,
            role: role
        });
    });
}

function createAvailableTime(
    teacherId,
    date,
    startTime,
    endTime,
    activity,
    callback
) {
    const sql = `
        INSERT INTO available_times
        (teacher_id, date, start_time, end_time, activity)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [teacherId, date, startTime, endTime, activity],
        function (err) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, {
                id: this.lastID,
                teacherId: teacherId,
                date: date,
                startTime: startTime,
                endTime: endTime,
                activity: activity,
                status: "available"
            });
        }
    );
}

module.exports = {
    db,
    createUser,
    createAvailableTime
};