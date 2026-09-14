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
        email: req.query.email || ""
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
            error: "Vänligen fyll i både e-postadress och lösenord."
        });
    }

    // Slå upp användaren via e-post
    db.getUserByEmail(email, (err, user) => {
        if (err || !user) {
            return res.render("login", {
                title: "Logga in",
                role: role,
                email: email,
                error: "Felaktig e-postadress eller lösenord."
            });
        }

        // Kontrollera lösenord
        if (user.password !== password) {
            return res.render("login", {
                title: "Logga in",
                role: role,
                email: email,
                error: "Felaktig e-postadress eller lösenord."
            });
        }

        // Skapa inloggad session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
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
        error: null
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
            error: "Vänligen fyll i alla fält."
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
                error: "En användare med denna e-postadress finns redan."
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
                    error: "Kunde inte skapa kontot. Försök igen."
                });
            }

            console.log(`Ny användare skapad: ${newUser.name} (${newUser.email}, ${newUser.role})`);

            // Sätt inloggad session direkt
            req.session.user = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
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

module.exports = router;
