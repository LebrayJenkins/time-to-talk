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
                status TEXT NOT NULL DEFAULT 'tillgänglig',
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
                status TEXT NOT NULL DEFAULT 'bokad',
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
                status: "tillgänglig"
            });
        }
    );
}

function getAvailableTimes(callback) {
    const sql = `
        SELECT
            available_times.id,
            available_times.date,
            available_times.start_time,
            available_times.end_time,
            available_times.activity,
            users.name AS teacher_name
        FROM available_times
        JOIN users ON available_times.teacher_id = users.id
        WHERE available_times.status = 'tillgänglig'
        ORDER BY available_times.date, available_times.start_time
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            callback(err);
            return;
        }

        callback(null, rows);
    });
}

function createBooking(availableTimeId, studentId, callback) {
    const checkSql = `
        SELECT status
        FROM available_times
        WHERE id = ?
    `;

    db.get(checkSql, [availableTimeId], (err, time) => {
        if (err) {
            callback(err);
            return;
        }

        if (!time) {
            callback(new Error("Tiden finns inte."));
            return;
        }

        if (time.status !== "tillgänglig") {
            callback(new Error("Tiden är inte tillgänglig."));
            return;
        }

        const sql = `
            INSERT INTO bookings (available_time_id, student_id)
            VALUES (?, ?)
        `;

        db.run(sql, [availableTimeId, studentId], function (err) {
            if (err) {
                callback(err);
                return;
            }

            db.run(
                `UPDATE available_times
                 SET status = 'bokad'
                 WHERE id = ?`,
                [availableTimeId],
                (updateErr) => {
                    if (updateErr) {
                        callback(updateErr);
                        return;
                    }

                    callback(null, {
                        id: this.lastID,
                        availableTimeId: availableTimeId,
                        studentId: studentId,
                        status: "bokad"
                    });
                }
            );
        });
    });
}

module.exports = {
    db,
    createUser,
    createAvailableTime,
    getAvailableTimes,
    createBooking
};
