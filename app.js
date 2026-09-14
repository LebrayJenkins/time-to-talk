const express = require("express");
const path = require("path");

const session = require("express-session");

const indexRouter = require("./routes/index");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "timetotalk-secret-key-12345",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use("/", indexRouter);

app.listen(PORT, () => {
  console.log(`TimeToTalk körs på http://localhost:${PORT}`);
});
