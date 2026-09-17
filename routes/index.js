const express = require("express");
const db = require("../database");

const router = express.Router();

/* Startsida */
router.get("/", (req, res) => {
  res.render("index", {
    title: "Startsida",
  });
});

/* GET: Inloggningssida */
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Logga in",
    role: req.query.role || "teacher",
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
    return res.redirect("/");
  });
});

/* GET: Registreringssida */
router.get("/register", (req, res) => {
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

/* GET: Visa sidan där läraren skapar tider */
router.get("/teacher/tider/skapa", (req, res) => {
  res.render("teacher-create-time");
});

/* POST: Spara lärarens nya tid */
router.post("/teacher/tider/skapa", (req, res) => {
  const activity = req.body.activity;
  const date = req.body.date;
  const startTime = req.body.start_time;
  const endTime = req.body.end_time;

  console.log("Vald aktivitet:", activity);
  console.log("Datum:", date);
  console.log("Starttid:", startTime);
  console.log("Sluttid:", endTime);

  const today = new Date().toISOString().split("T")[0];

  if (date < today) {
    return res
      .status(400)
      .send("Datumet kan inte vara tidigare än dagens datum.");
  }

  if (endTime <= startTime) {
    return res.status(400).send("Sluttiden måste vara efter starttiden.");
  }

  const teacherId = 1; // Hårdkodat lärar-ID för teständamål

  db.createAvailableTime(
    teacherId,
    date,
    startTime,
    endTime,
    activity,
    (err, time) => {
      if (err) {
        console.error("Fel när tiden skulle sparas:", err.message);
        return res.status(500).send("Kunde inte spara tiden.");
      }

      console.log("Tid sparad:", time);

      res.send(`
        <h1>Tiden är skapad!</h1>
        <p>Aktivitet: ${time.activity}</p>
        <p>Datum: ${time.date}</p>
        <p>Tid: ${time.startTime} - ${time.endTime}</p>
      `);
    },
  );
});

/* GET: Elevens dashboard */
router.get("/student-dashboard", (req, res) => {
  res.render("student-dashboard", {
    title: "Min översikt",
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
    });
  });
});

module.exports = router;
