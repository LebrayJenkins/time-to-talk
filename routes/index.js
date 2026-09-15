const express = require("express");
const db = require("../database");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("index", {
    title: "Startsida",
  });
});

router.get("/teacher/tider/skapa", (req, res) => {
  res.render("teacher-create-time");
});

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

  const teacherId = 1; // Hårdkodad lärar-ID för teständamål

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

router.get("/student-dashboard", (req, res) => {
  res.render("student-dashboard", {
    title: "Min översikt",
  });
});
module.exports = router;
