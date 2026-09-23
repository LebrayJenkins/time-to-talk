const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "timetotalk.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Kunde inte öppna databasen:", err.message);
  } else {
    console.log("SQLite-databasen är ansluten.");

    //aktivera foregin keys
    db.run("PRAGMA foreign_keys = ON");

    //skapa users-tabellen
    db.run(
      `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('student', 'teacher'))
            )
        `,
      (err) => {
        if (err) {
          console.error("Kunde inte skapa tabellen:", err.message);
        } else {
          console.log("Tabellen 'users' är skapad eller finns redan.");
        }
      },
    );

    //skapa available_times-tabellen
    db.run(
      `
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
        `,
      (err) => {
        if (err) {
          console.error(
            "Kunde inte skapa available_times-tabellen:",
            err.message,
          );
        } else {
          console.log(
            "Tabellen 'available_times' är skapad eller finns redan.",
          );
        }
      },
    );

    //skapa bookings-tabellen
    db.run(
      `
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,   
                available_time_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'bokad',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (available_time_id) REFERENCES available_times (id),
                FOREIGN KEY (student_id) REFERENCES users (id)
            )
        `,
      (err) => {
        if (err) {
          console.error("Kunde inte skapa bookings-tabellen:", err.message);
        } else {
          console.log("Tabellen 'bookings' är skapad eller finns redan.");
          seedInitialData(db);
        }
      },
    );
  }
});

function seedInitialData(database) {
  // Skapar endast initiala standardkonton om users-tabellen är helt tom
  database.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (!err && row && row.count === 0) {
      console.log("Databasen är tom. Skapar grundanvändare...");
      database.run(
        `INSERT INTO users (name, email, password, role) VALUES 
                ('Sara Svensson', 'sara@timetotalk.se', 'larare123', 'teacher'),
                ('Martin Lindgren', 'martin@timetotalk.se', 'larare123', 'teacher'),
                ('Mårten Larsson', 'marten@skola.se', 'elev123', 'student')`,
      );
    }
  });
}

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
      role: role,
    });
  });
}

function createUser(name, email, password, role, callback) {
  const sql = `
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    `;

  db.run(
    sql,
    [name.trim(), email.trim().toLowerCase(), password, role],
    function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, {
        id: this.lastID,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role,
      });
    },
  );
}

function getUserByEmail(email, callback) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const sql = `
        SELECT id, name, email, password, role
        FROM users
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
    `;

  db.get(sql, [cleanEmail], (err, user) => {
    if (err) {
      callback(err);
      return;
    }

    if (!user) {
      callback(new Error("Användaren finns inte."));
      return;
    }

    callback(null, user);
  });
}

function createAvailableTime(
  teacherId,
  date,
  startTime,
  endTime,
  activity,
  callback,
) {
  const sql = `
        INSERT INTO available_times
        (teacher_id, date, start_time, end_time, activity)
        VALUES (?, ?, ?, ?, ?)
    `;

  db.run(sql, [teacherId, date, startTime, endTime, activity], function (err) {
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
      status: "tillgänglig",
    });
  });
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

function getAvailableTimeById(timeId, callback) {
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
    WHERE available_times.id = ?
      AND available_times.status = 'tillgänglig'
  `;

  db.get(sql, [timeId], callback);
}

function createBooking(availableTimeId, studentId, callback) {
  // En egen anslutning håller bokningen samlad i en transaktion.
  const connection = new sqlite3.Database(dbPath, (openErr) => {
    if (openErr) {
      return callback(openErr);
    }

    connection.configure("busyTimeout", 5000);

    connection.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
      if (beginErr) {
        return finish(beginErr);
      }

      // Bara en fortfarande ledig tid får ändras till bokad.
      connection.run(
        `UPDATE available_times
         SET status = 'bokad'
         WHERE id = ?
           AND status = 'tillgänglig'`,
        [availableTimeId],
        function (updateErr) {
          if (updateErr) {
            return rollback(updateErr);
          }

          if (this.changes === 0) {
            const error = new Error("Tiden är inte längre ledig.");
            error.code = "TIME_UNAVAILABLE";
            return rollback(error);
          }

          connection.run(
            `INSERT INTO bookings (available_time_id, student_id, status)
             VALUES (?, ?, 'bokad')`,
            [availableTimeId, studentId],
            function (insertErr) {
              if (insertErr) {
                return rollback(insertErr);
              }

              const bookingId = this.lastID;

              connection.run("COMMIT", (commitErr) => {
                if (commitErr) {
                  return rollback(commitErr);
                }

                finish(null, { id: bookingId });
              });
            },
          );
        },
      );
    });
  });

  function finish(err, booking) {
    connection.close((closeErr) => {
      callback(err || closeErr, booking);
    });
  }

  function rollback(err) {
    connection.run("ROLLBACK", () => finish(err));
  }
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
              availableTimeId: booking.available_time_id,
            });
          },
        );
      },
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
            bookings.id AS booking_id,
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
  callback,
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

  db.run(sql, [date, startTime, endTime, activity, timeId], function (err) {
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
      activity: activity,
    });
  });
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
              status: "avbokad",
            });
          },
        );
      },
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

function deleteUser(id, callback) {
  db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, { deletedId: id, changes: this.changes });
  });
}

/* Hämta en bokning som tillhör den inloggade eleven */
function getBookingDetailsForStudent(bookingId, studentId, callback) {
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
        WHERE bookings.id = ?
          AND bookings.student_id = ?
          AND bookings.status = 'bokad'
    `;

  db.get(sql, [bookingId, studentId], callback);
}

/* Hämta en bokning som tillhör den inloggade läraren */
function getBookingDetailsForTeacher(bookingId, teacherId, callback) {
  const sql = `
        SELECT
            bookings.id,
            available_times.id AS available_time_id,
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
          AND available_times.teacher_id = ?
          AND bookings.status = 'bokad'
    `;

  db.get(sql, [bookingId, teacherId], callback);
}
/* Avboka en bokning som tillhör den inloggade eleven */
function cancelBookingForStudent(bookingId, studentId, callback) {
  // Egen anslutning håller transaktionen separat från andra anrop.
  const connection = new sqlite3.Database(dbPath, (openErr) => {
    if (openErr) {
      return callback(openErr);
    }

    connection.configure("busyTimeout", 5000);

    connection.run("PRAGMA foreign_keys = ON", (pragmaErr) => {
      if (pragmaErr) {
        return finish(pragmaErr);
      }

      connection.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
        if (beginErr) {
          return finish(beginErr);
        }

        connection.get(
          `SELECT available_time_id
           FROM bookings
           WHERE id = ?
             AND student_id = ?
             AND status = 'bokad'`,
          [bookingId, studentId],
          (err, booking) => {
            if (err) {
              return rollback(err);
            }

            if (!booking) {
              const error = new Error("Bokningen hittades inte.");
              error.code = "BOOKING_NOT_FOUND";
              return rollback(error);
            }

            connection.run(
              `UPDATE bookings
               SET status = 'avbokad'
               WHERE id = ?
                 AND student_id = ?
                 AND status = 'bokad'`,
              [bookingId, studentId],
              (updateErr) => {
                if (updateErr) {
                  return rollback(updateErr);
                }

                // Återöppna inte en tid som läraren har avbokat.
                // Frigör inte heller tiden om någon annan bokning finns.
                connection.run(
                  `UPDATE available_times
                   SET status = 'tillgänglig'
                   WHERE id = ?
                     AND status = 'bokad'
                     AND NOT EXISTS (
                       SELECT 1
                       FROM bookings
                       WHERE available_time_id = ?
                         AND status = 'bokad'
                     )`,
                  [booking.available_time_id, booking.available_time_id],
                  (timeErr) => {
                    if (timeErr) {
                      return rollback(timeErr);
                    }

                    connection.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        return rollback(commitErr);
                      }

                      finish(null, {
                        bookingId: bookingId,
                        status: "avbokad",
                      });
                    });
                  },
                );
              },
            );
          },
        );
      });
    });
  });

  function finish(err, result) {
    connection.close((closeErr) => {
      if (closeErr) {
        console.error("Kunde inte stänga anslutningen:", closeErr.message);
      }

      callback(err, result);
    });
  }

  function rollback(err) {
    connection.run("ROLLBACK", (rollbackErr) => {
      if (rollbackErr) {
        console.error(
          "Kunde inte återställa transaktionen:",
          rollbackErr.message,
        );
      }

      finish(err);
    });
  }
}

module.exports = {
  db,
  createUser,
  getUserByEmail,
  deleteUser,
  createAvailableTime,
  getAvailableTimes,
  createBooking,
  getBookingsForStudent,
  cancelBooking,
  getBookingsForTeacher,
  getTeacherTimes,
  updateAvailableTime,
  cancelAvailableTime,
  getBookingDetails,
  getBookingDetailsForStudent,
  getBookingDetailsForTeacher,
  cancelBookingForStudent,
  getAvailableTimeById,
};
