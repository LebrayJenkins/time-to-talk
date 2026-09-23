const express = require("express");
const db = require("../database");

const router = express.Router();

/**
 * Middleware för att kontrollera lärarbehörighet
 */
function requireTeacher(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "teacher") {
    return next();
  }
  return res.redirect("/login?role=teacher&error=" + encodeURIComponent("Vänligen logga in som lärare."));
}

/* Startsida: omdirigera direkt till inloggning */
router.get("/", (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === "teacher") {
      return res.redirect("/teacher/dashboard");
    }
    if (req.session.user.role === "student") {
      return res.redirect("/student-dashboard");
    }
  }
  res.redirect("/login");
});

/* GET: Inloggningssida */
router.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === "teacher") {
      return res.redirect("/teacher/dashboard");
    }
    if (req.session.user.role === "student") {
      return res.redirect("/student-dashboard");
    }
  }
  res.render("login", {
    title: "Logga in",
    role: req.query.role || "student",
    error: req.query.error || null,
    email: req.query.email || "",
  });
});

/* POST: Hantera inloggning */
router.post("/login", (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = (req.body.password || "").trim();
  const role = req.body.role || "teacher";

  // Validera tomma fält
  if (!email || !password) {
    return res.render("login", {
      title: "Logga in",
      role: role,
      email: email,
      error: "Vänligen fyll i både e-postadress och lösenord.",
    });
  }

  // Slå upp användaren via e-post
  db.getUserByEmail(email, (err, user) => {
    if (err || !user) {
      return res.render("login", {
        title: "Logga in",
        role: role,
        email: email,
        error: "Felaktig e-postadress eller lösenord.",
      });
    }

    // Kontrollera lösenord
    if (user.password !== password) {
      return res.render("login", {
        title: "Logga in",
        role: role,
        email: email,
        error: "Felaktig e-postadress eller lösenord.",
      });
    }

    // Skapa inloggad session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    console.log(`Inloggning lyckades: ${user.name} (${user.role})`);
    if (user.role === "teacher") {
      return res.redirect("/teacher/dashboard");
    } else if (user.role === "student") {
      return res.redirect("/student-dashboard");
    }
    return res.redirect("/");
  });
});

/* GET: Registreringssida */
router.get("/register", (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === "teacher") {
      return res.redirect("/teacher/dashboard");
    }
    if (req.session.user.role === "student") {
      return res.redirect("/student-dashboard");
    }
  }
  res.render("register", {
    title: "Skapa konto",
    role: req.query.role || "teacher",
    name: "",
    email: "",
    error: null,
  });
});

/* POST: Skapa konto i SQLite-databasen */
router.post("/register", (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const role = req.body.role || "teacher";

  if (!name || !email || !password) {
    return res.render("register", {
      title: "Skapa konto",
      role: role,
      name: name,
      email: email,
      error: "Vänligen fyll i alla fält.",
    });
  }

  // Kontrollera om användaren redan finns
  db.getUserByEmail(email, (checkErr, existingUser) => {
    if (existingUser) {
      return res.render("register", {
        title: "Skapa konto",
        role: role,
        name: name,
        email: email,
        error: "En användare med denna e-postadress finns redan.",
      });
    }

    // Skapa användaren i databasen
    db.createUser(name, email, password, role, (createErr, newUser) => {
      if (createErr) {
        console.error("Fel vid skapande av användare:", createErr.message);

        return res.render("register", {
          title: "Skapa konto",
          role: role,
          name: name,
          email: email,
          error: "Kunde inte skapa kontot. Försök igen.",
        });
      }

      console.log(
        `Ny användare skapad: ${newUser.name} (${newUser.email}, ${newUser.role})`,
      );

      // Sätt inloggad session direkt
      req.session.user = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      };

      if (newUser.role === "teacher") {
        return res.redirect("/teacher/dashboard");
      } else if (newUser.role === "student") {
        return res.redirect("/student-dashboard");
      }
      return res.redirect("/");
    });
  });
});

/* GET: Logga ut */
router.get("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Fel vid utloggning:", err);
      }
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

/* GET: Lärardashboard */
router.get("/teacher/dashboard", requireTeacher, (req, res) => {
  const teacher = req.session.user;
  db.getTeacherTimes(teacher.id, (err, rows) => {
    if (err) {
      console.error("Kunde inte hämta tider för lärare:", err.message);
      rows = [];
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayIso = `${year}-${month}-${day}`;
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    const todayFormatted = `${now.getDate()} ${months[now.getMonth()]}`;

    // Läs flashmeddelande från session (visas bara en gång)
    const success = req.session.flash_success || false;
    const deleted = req.session.flash_deleted || false;
    delete req.session.flash_success;
    delete req.session.flash_deleted;

    // Visa dagens och kommande tider så att skapade tider inte försvinner vid uppdatering
    const timesToShow = (rows || []).filter((b) => b.date >= todayIso);

    const formattedBookings = timesToShow.map((b) => {
      let dateFormatted;
      let isToday = b.date === todayIso;
      if (isToday) {
        dateFormatted = "Idag";
      } else {
        const parts = b.date.split("-");
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        dateFormatted = `${day} ${months[monthIdx]}`;
      }
      return {
        ...b,
        dateFormatted,
        isToday,
      };
    });

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.render("teacher-dashboard", {
      title: "Min översikt",
      teacher: teacher,
      bookings: formattedBookings,
      todayFormatted: todayFormatted,
      success: success,
      deleted: deleted,
    });
  });
});

/* Alias: /teacher-dashboard */
router.get("/teacher-dashboard", (req, res) => {
  res.redirect("/teacher/dashboard");
});

/* GET: Visa sidan där läraren skapar tider */
router.get("/teacher/tider/skapa", requireTeacher, (req, res) => {
  res.render("teacher-create-time", { error: null });
});

/* POST: Spara lärarens nya tid */
router.post("/teacher/tider/skapa", requireTeacher, (req, res) => {
  const activity = req.body.activity;
  const date = req.body.date;
  const startTime = req.body.start_time;
  const endTime = req.body.end_time;

  console.log("Vald aktivitet:", activity);
  console.log("Datum:", date);
  console.log("Starttid:", startTime);
  console.log("Sluttid:", endTime);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  if (!activity || !date || !startTime || !endTime) {
    return res.status(400).render("teacher-create-time", {
      error: "Vänligen fyll i alla fält.",
    });
  }

  if (date < today) {
    return res.status(400).render("teacher-create-time", {
      error: "Datumet kan inte vara tidigare än dagens datum.",
    });
  }

  if (endTime <= startTime) {
    return res.status(400).render("teacher-create-time", {
      error: "Sluttiden måste vara efter starttiden.",
    });
  }

  const teacherId = req.session.user.id;

  db.createAvailableTime(
    teacherId,
    date,
    startTime,
    endTime,
    activity,
    (err, time) => {
      if (err) {
        console.error("Fel när tiden skulle sparas:", err.message);
        return res.status(500).render("teacher-create-time", {
          error: "Kunde inte spara tiden. Försök igen.",
        });
      }

      console.log("Tid sparad för lärare:", teacherId, time);
      // Spara flashmeddelande i session – försvinner efter att sidan laddats
      req.session.flash_success = true;
      res.redirect("/teacher/dashboard");
    },
  );
});

/* POST: Ta bort / avboka tid */
router.post("/teacher/tider/:id/ta-bort", requireTeacher, (req, res) => {
  const timeId = parseInt(req.params.id, 10);
  const teacherId = parseInt(req.session.user.id, 10);

  console.log(`[TA-BORT] Lärare ${teacherId} begär radering av tid ${timeId}`);

  // 1. Ta bort eventuella bokningar först för att tillfredsställa foreign key
  db.db.run(
    "DELETE FROM bookings WHERE available_time_id = ?",
    [timeId],
    (bookErr) => {
      if (bookErr) {
        console.error("[TA-BORT] Kunde inte radera bokningar:", bookErr.message);
      }

      // 2. Radera tiden permanent från available_times
      db.db.run(
        "DELETE FROM available_times WHERE id = ? AND teacher_id = ?",
        [timeId, teacherId],
        function (delErr) {
          if (delErr) {
            console.error("[TA-BORT] Fel vid DELETE, sätter som avbokad istället:", delErr.message);
            db.db.run(
              "UPDATE available_times SET status = 'avbokad' WHERE id = ? AND teacher_id = ?",
              [timeId, teacherId],
              () => {
                req.session.flash_deleted = true;
                res.redirect("/teacher/dashboard");
              }
            );
            return;
          }
          console.log(`[TA-BORT] Tid ${timeId} raderad permanent! Rader ändrade:`, this.changes);
          req.session.flash_deleted = true;
          res.redirect("/teacher/dashboard");
        }
      );
    }
  );
});

/* GET: Elevens dashboard */
router.get("/student-dashboard", (req, res) => {
  res.render("student-dashboard", {
    title: "Min översikt",
  });
});

module.exports = router;
