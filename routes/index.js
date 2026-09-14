const express = require("express");

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

    console.log("Vald aktivitet:", activity);

    res.send(`Aktivitet mottagen: ${activity}`);
});

module.exports = router;
