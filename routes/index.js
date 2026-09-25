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
  return res.redirect(
    "/login?role=teacher&error=" +
      encodeURIComponent("Vänligen logga in som lärare."),
  );
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
  db.getBookingsForTeacher(teacher.id, (err, rows) => {
    if (err) {
      console.error("Kunde inte hämta bokningar för lärare:", err.message);
      rows = [];
    }

    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    const todayIso = `${values.year}-${values.month}-${values.day}`;
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    const monthIdx = parseInt(values.month, 10) - 1;
    const todayFormatted = `${parseInt(values.day, 10)} ${months[monthIdx]}`;

    // Läs flashmeddelande från session (visas bara en gång)
    const success = req.session.flash_success || false;
    delete req.session.flash_success;

    // Visa endast dagens bokningar
    const timesToShow = (rows || []).filter((b) => b.date === todayIso);

    const formattedBookings = timesToShow.map((b) => {
      return {
        ...b,
        booking_id: b.id, // ID från bookings-tabellen
        dateFormatted: "Idag",
        isToday: true,
      };
    });

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.render("teacher-dashboard", {
      title: "Min översikt",
      teacher: teacher,
      bookings: formattedBookings,
      todayFormatted: todayFormatted,
      success: success,
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

/* Kontrollera att användaren är inloggad som elev */
function requireStudent(req, res, next) {
  const user = req.session && req.session.user;

  if (!user) {
    return res.redirect(
      "/login?role=student&error=" +
        encodeURIComponent("Vänligen logga in som elev."),
    );
  }

  if (user.role !== "student") {
    return res.status(403).send("Den här sidan är endast för elever.");
  }

  next();
}

/* GET: Elevens dashboard */
router.get("/student-dashboard", requireStudent, (req, res) => {
  const student = req.session.user;

  db.getBookingsForStudent(student.id, (err, bookings) => {
    if (err) {
      console.error("Kunde inte hämta elevens bokningar:", err.message);
      return res
        .status(500)
        .send("Kunde inte hämta dina bokningar. Försök igen senare.");
    }

    // Jämför med datum och tid i Sverige.
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    const today = `${values.year}-${values.month}-${values.day}`;
    const currentTime = `${values.hour}:${values.minute}:${values.second}`;

    // Visa framtida bokningar och bokningar som fortfarande pågår.
    const upcomingBookings = bookings.filter((booking) => {
      const endTime =
        booking.end_time.length === 5
          ? `${booking.end_time}:00`
          : booking.end_time;

      return (
        booking.date > today ||
        (booking.date === today && endTime > currentTime)
      );
    });

    res.render("student-dashboard", {
      title: "Min översikt",
      bookings: upcomingBookings.slice(0, 1),
      studentName: student.name,
      bookingCancelled: req.query.success === "cancelled",
    });
  });
});

/* GET: Visa elevens lediga tider */
router.get("/student/lediga-tider", (req, res) => {
  db.getAvailableTimes((err, availableTimes) => {
    if (err) {
      console.error("Fel vid hämtning av lediga tider:", err.message);
      return res.status(500).send("Kunde inte hämta lediga tider.");
    }

    res.render("student-available-times", {
      title: "Välj datum och tid",
      availableTimes: availableTimes,
      bookingError: req.query.error === "unavailable",
    });
  });
});

/* GET: Visa vald tid innan eleven bekräftar bokningen */
router.get("/student/bokningar/bekrafta", requireStudent, (req, res) => {
  const timeId = Number(req.query.timeId);

  if (!Number.isSafeInteger(timeId) || timeId <= 0) {
    return res.redirect("/student/lediga-tider");
  }

  db.getAvailableTimeById(timeId, (err, time) => {
    if (err) {
      console.error("Kunde inte hämta tiden:", err.message);
      return res.status(500).send("Kunde inte hämta tiden.");
    }

    if (!time) {
      return res.redirect("/student/lediga-tider?error=unavailable");
    }

    res.render("student-booking-confirmation", {
      title: "Bekräfta din bokning",
      time: time,
    });
  });
});

/* POST: Spara elevens bokning */
router.post("/student/bokningar/bekrafta", requireStudent, (req, res) => {
  const timeId = Number(req.body.timeId);
  const studentId = req.session.user.id;

  if (!Number.isSafeInteger(timeId) || timeId <= 0) {
    return res.status(400).send("Ogiltigt tidsnummer.");
  }

  db.createBooking(timeId, studentId, (err, booking) => {
    if (err) {
      if (err.code === "TIME_UNAVAILABLE") {
        return res.redirect(303, "/student/lediga-tider?error=unavailable");
      }

      console.error("Kunde inte skapa bokningen:", err.message);
      return res.status(500).send("Kunde inte skapa bokningen.");
    }

    return res.redirect(303, `/student/bokningar/${booking.id}/klar`);
  });
});

/* GET: Visa att elevens bokning är klar */
router.get("/student/bokningar/:id/klar", requireStudent, (req, res) => {
  const bookingId = Number(req.params.id);
  const studentId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.getBookingDetailsForStudent(bookingId, studentId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);
      return res.status(500).send("Kunde inte visa bokningen.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    res.render("student-booking-success", {
      title: "Bokningen är klar",
      booking: booking,
    });
  });
});

/* GET: Lista elevens egna bokningar */
router.get("/student/bokningar", requireStudent, (req, res) => {
  const studentId = req.session.user.id;

  db.getBookingsForStudent(studentId, (err, bookings) => {
    if (err) {
      console.error("Kunde inte hämta elevens bokningar:", err.message);
      return res
        .status(500)
        .send("Kunde inte hämta dina bokningar. Försök igen senare.");
    }

    res.render("student-bookings-list", {
      title: "Mina bokningar",
      bookings: bookings,
    });
  });
});

/* GET: Visa detaljer för elevens egen bokning */
router.get("/student/bokningar/:id", requireStudent, (req, res) => {
  const bookingId = Number(req.params.id);
  const studentId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.getBookingDetailsForStudent(bookingId, studentId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);

      return res
        .status(500)
        .send("Kunde inte hämta bokningen. Försök igen senare.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    res.render("student-booking-details", {
      title: "Bokningsdetaljer",
      booking: booking,
    });
  });
});

/* GET: Visa bekräftelse innan eleven avbokar */
router.get("/student/bokningar/:id/avboka", requireStudent, (req, res) => {
  const bookingId = Number(req.params.id);
  const studentId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.getBookingDetailsForStudent(bookingId, studentId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);
      return res.status(500).send("Kunde inte visa bokningen.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    res.render("student-booking-cancellation-confirmation", {
      title: "Bekräfta avbokning",
      booking: booking,
    });
  });
});

/* POST: Avboka elevens egen bokning */
router.post("/student/bokningar/:id/avboka", requireStudent, (req, res) => {
  const bookingId = Number(req.params.id);
  const studentId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.cancelBookingForStudent(bookingId, studentId, (err) => {
    if (err) {
      if (err.code === "BOOKING_NOT_FOUND") {
        return res
          .status(404)
          .send("Bokningen finns inte eller är redan avbokad.");
      }

      console.error("Kunde inte avboka bokningen:", err.message);
      return res
        .status(500)
        .send("Kunde inte avboka bokningen. Försök igen senare.");
    }

    res.redirect(303, "/student-dashboard?success=cancelled");
  });
});

/* GET: Visa detaljer för lärarens bokning */
router.get("/teacher/bokningar/:id", requireTeacher, (req, res) => {
  const bookingId = Number(req.params.id);
  const teacherId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.getBookingDetailsForTeacher(bookingId, teacherId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);

      return res
        .status(500)
        .send("Kunde inte hämta bokningen. Försök igen senare.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    res.render("teacher-booking-details", {
      title: "Bokningsdetaljer",
      booking: booking,
      query: req.query,
    });
  });
});

/* GET: Ändra tid för lärarens bokning */
router.get("/teacher/bokningar/:id/andra", requireTeacher, (req, res) => {
  const bookingId = Number(req.params.id);
  const teacherId = req.session.user.id;

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  db.getBookingDetailsForTeacher(bookingId, teacherId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);
      return res
        .status(500)
        .send("Kunde inte hämta bokningen. Försök igen senare.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    res.render("teacher-edit-booking", {
      title: "Ändra tid",
      booking: booking,
    });
  });
});

/* POST: Spara ändringar av lärarens bokning */
router.post("/teacher/bokningar/:id/andra", requireTeacher, (req, res) => {
  const bookingId = Number(req.params.id);
  const teacherId = req.session.user.id;

  const { date, start_time, end_time, activity } = req.body;

  const allowedActivities = ["Handledning", "Redovisning", "Muntligt förhör"];

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).send("Ogiltigt bokningsnummer.");
  }

  if (!date || !start_time || !end_time || !activity) {
    return res.status(400).send("Alla fält måste fyllas i.");
  }

  if (!allowedActivities.includes(activity)) {
    return res.status(400).send("Ogiltig aktivitet.");
  }

  db.getBookingDetailsForTeacher(bookingId, teacherId, (err, booking) => {
    if (err) {
      console.error("Kunde inte hämta bokningen:", err.message);
      return res
        .status(500)
        .send("Kunde inte hämta bokningen. Försök igen senare.");
    }

    if (!booking) {
      return res.status(404).send("Bokningen hittades inte.");
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    if (date < today) {
      return res.status(400).send("Datumet kan inte vara tidigare än idag.");
    }

    if (end_time <= start_time) {
      return res.status(400).send("Sluttiden måste vara senare än starttiden.");
    }

    const bookingDateTime = new Date(`${booking.date}T${booking.end_time}`);

    if (bookingDateTime <= now) {
      return res
        .status(400)
        .send("Bokningen har redan passerat och kan inte ändras.");
    }

    const availableTimeId = booking.available_time_id;

    db.updateAvailableTime(
      availableTimeId,
      date,
      start_time,
      end_time,
      activity,
      (err) => {
        if (err) {
          console.error("Kunde inte uppdatera tiden:", err.message);
          return res
            .status(500)
            .send("Kunde inte spara ändringarna. Försök igen senare.");
        }

        res.redirect(`/teacher/bokningar/${bookingId}?success=updated`);
      },
    );
  });
});

module.exports = router;
