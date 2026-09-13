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
            INSERT INTO bookings (available_time_id, student_id, status)
            VALUES (?, ?, 'bokad')
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

function getBookingsForStudent(studentId, callback) {
    const sql = `
        SELECT
            bookings.id,
            available_times.date,
            available_times.start_time,
            available_times.end_time,
            available_times.activity,
            users.name AS teacher_name
        FROM bookings
        JOIN available_times
            ON bookings.available_time_id = available_times.id
        JOIN users
            ON available_times.teacher_id = users.id
        WHERE bookings.student_id = ?
          AND bookings.status = 'bokad'
        ORDER BY available_times.date, available_times.start_time
    `;

    db.all(sql, [studentId], (err, rows) => {
        if (err) {
            callback(err);
            return;
        }

        callback(null, rows);
    });
}

function cancelBooking(bookingId, callback) {
    const sql = `
        SELECT available_time_id
        FROM bookings
        WHERE id = ?
          AND status = 'bokad'
    `;

    db.get(sql, [bookingId], (err, booking) => {
        if (err) {
            callback(err);
            return;
        }

        if (!booking) {
            callback(new Error("Bokningen finns inte eller är redan avbokad."));
            return;
        }

        db.run(
            `UPDATE bookings
             SET status = 'avbokad'
             WHERE id = ?`,
            [bookingId],
            (updateErr) => {
                if (updateErr) {
                    callback(updateErr);
                    return;
                }

                db.run(
                    `UPDATE available_times
                     SET status = 'tillgänglig'
                     WHERE id = ?`,
                    [booking.available_time_id],
                    (timeErr) => {
                        if (timeErr) {
                            callback(timeErr);
                            return;
                        }

                        callback(null, {
                            bookingId: bookingId,
                            status: "avbokad",
                            availableTimeId: booking.available_time_id
                        });
                    }
                );
            }
        );
    });
}

function getBookingsForTeacher(teacherId, callback) {
    const sql = `
        SELECT
            bookings.id,
            available_times.date,
            available_times.start_time,
            available_times.end_time,
            available_times.activity,
            users.name AS student_name
        FROM bookings
        JOIN available_times
            ON bookings.available_time_id = available_times.id
        JOIN users
            ON bookings.student_id = users.id
        WHERE available_times.teacher_id = ?
          AND bookings.status = 'bokad'
        ORDER BY available_times.date, available_times.start_time
    `;

    db.all(sql, [teacherId], (err, rows) => {
        if (err) {
            callback(err);
            return;
        }

        callback(null, rows);
    });
}

function getTeacherTimes(teacherId, callback) {
    const sql = `
        SELECT
            available_times.id,
            available_times.date,
            available_times.start_time,
            available_times.end_time,
            available_times.activity,
            available_times.status,
            users.name AS student_name
        FROM available_times
        LEFT JOIN bookings
            ON available_times.id = bookings.available_time_id
            AND bookings.status = 'bokad'
        LEFT JOIN users
            ON bookings.student_id = users.id
        WHERE available_times.teacher_id = ?
        ORDER BY available_times.date, available_times.start_time
    `;

    db.all(sql, [teacherId], (err, rows) => {
        if (err) {
            callback(err);
            return;
        }

        callback(null, rows);
    });
}

function updateAvailableTime(
    timeId,
    date,
    startTime,
    endTime,
    activity,
    callback
) {
    const sql = `
        UPDATE available_times
        SET
            date = ?,
            start_time = ?,
            end_time = ?,
            activity = ?
        WHERE id = ?
    `;

    db.run(
        sql,
        [date, startTime, endTime, activity, timeId],
        function (err) {
            if (err) {
                callback(err);
                return;
            }

            if (this.changes === 0) {
                callback(new Error("Tiden finns inte."));
                return;
            }

            callback(null, {
                id: timeId,
                date: date,
                startTime: startTime,
                endTime: endTime,
                activity: activity
            });
        }
    );
}

function cancelAvailableTime(timeId, callback) {
    const sql = `
        SELECT status
        FROM available_times
        WHERE id = ?
    `;

    db.get(sql, [timeId], (err, time) => {
        if (err) {
            callback(err);
            return;
        }

        if (!time) {
            callback(new Error("Tiden finns inte."));
            return;
        }

        db.run(
            `UPDATE available_times
             SET status = 'avbokad'
             WHERE id = ?`,
            [timeId],
            (updateErr) => {
                if (updateErr) {
                    callback(updateErr);
                    return;
                }

                db.run(
                    `UPDATE bookings
                     SET status = 'avbokad'
                     WHERE available_time_id = ?
                       AND status = 'bokad'`,
                    [timeId],
                    (bookingErr) => {
                        if (bookingErr) {
                            callback(bookingErr);
                            return;
                        }

                        callback(null, {
                            id: timeId,
                            status: "avbokad"
                        });
                    }
                );
            }
        );
    });
}

function getBookingDetails(bookingId, callback) {
    const sql = `
        SELECT
            bookings.id,
            users.name AS student_name,
            users.email AS student_email,
            available_times.date,
            available_times.start_time,
            available_times.end_time,
            available_times.activity,
            teacher.name AS teacher_name
        FROM bookings
        JOIN users
            ON bookings.student_id = users.id
        JOIN available_times
            ON bookings.available_time_id = available_times.id
        JOIN users AS teacher
            ON available_times.teacher_id = teacher.id
        WHERE bookings.id = ?
          AND bookings.status = 'bokad'
    `;

    db.get(sql, [bookingId], (err, booking) => {
        if (err) {
            callback(err);
            return;
        }

        if (!booking) {
            callback(new Error("Bokningen finns inte eller är inte aktiv."));
            return;
        }

        callback(null, booking);
    });
}

module.exports = {
    db,
    createUser,
    createAvailableTime,
    getAvailableTimes,
    createBooking,
    getBookingsForStudent,
    cancelBooking,
    getBookingsForTeacher,
    getTeacherTimes,
    updateAvailableTime,
    cancelAvailableTime,
    getBookingDetails
};
