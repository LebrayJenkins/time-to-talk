# TimeToTalk

TimeToTalk är en bokningsapplikation för muntliga förhör eller redovisningar.

## Tekniker

- HTML och EJS
- CSS och Bootstrap
- JavaScript
- Node.js och Express
- Nodemon
- SQLite

## Starta projektet

Kör kommandona i projektets rotmapp, där `package.json` finns.

Första gången projektet öppnas:

```bash
npm install
npm run dev
```

### Öppna sedan

| Sida eller funktion                                       | Adress                                     |
| --------------------------------------------------------- | ------------------------------------------ |
| Startadress – omdirigerar till inloggning eller dashboard | http://localhost:3000/                     |
| Inloggning                                                | http://localhost:3000/login                |
| Registrering                                              | http://localhost:3000/register             |
| Elevens dashboard                                         | http://localhost:3000/student-dashboard    |
| Lediga tider för elever                                   | http://localhost:3000/student/lediga-tider |
| Lärarens dashboard                                        | http://localhost:3000/teacher/dashboard    |
| Alternativ adress till lärarens dashboard                 | http://localhost:3000/teacher-dashboard    |
| Skapa tider som lärare                                    | http://localhost:3000/teacher/tider/skapa  |
| Logga ut                                                  | http://localhost:3000/logout               |

Lärarens dashboard och sidan för att skapa tider kräver inloggning med ett lärarkonto. Annars omdirigeras du till inloggningssidan.

### Nästa gång projektet öppnas

Normalt räcker det med:

```bash
npm run dev
```

Kör `npm install` igen om:

- Projektets beroenden har ändrats i `package.json`.
- `package-lock.json` har ändrats, exempelvis efter att du hämtat gruppens senaste kod.
- Mappen `node_modules` saknas eller har tagits bort.

Stoppa servern med `Ctrl + C`.

## Projektstruktur

- `views` – projektets EJS-sidor
- `views/partials` – gemensamma delar som återanvänds
- `routes` – Express-routes som hanterar webbadresser och förfrågningar
- `public/stylesheets` – gemensam CSS samt CSS för enskilda sidor och komponenter
- `public/javascripts` – JavaScript som körs i webbläsaren
- `public/images` – bilder
- `app.js` – startar och konfigurerar Express
- `database.js` – kod för databasen
- `package.json` – projektets beroenden och scripts
- `package-lock.json` – låser beroendenas versioner

## Arbeta med Git

**Arbeta inte direkt i `main`. Gör alla ändringar på en separat branch och för in dem i `main` via en pull request.**

**Branchnamn, commit-meddelanden samt titlar och beskrivningar för pull requests ska vara på engelska.**

Kontrollera med `git status` och committa eventuellt pågående arbete på rätt branch innan du byter.

Hämta sedan senaste versionen och skapa en branch för din uppgift:

```bash
git switch main
git pull origin main
git switch -c docs/update-readme
```

Anpassa branchnamnet efter uppgiften.

Exempel på branchnamn:

- `feature/student-bookings`
- `fix/login-validation`
- `docs/update-readme`

Exempel på commit-meddelanden:

- `Add student booking overview`
- `Fix login validation`
- `Update project README`

Exempel på titel för en pull request:

```text
Update README with setup instructions and Git workflow
```

Exempel på beskrivning:

```text
Add local page URLs, clarify when to run npm install,
and document branch naming and commit conventions.
```

## Tillgänglighet

TimeToTalk utvecklas med WCAG 2.2 nivå AA som mål. Sidorna ska fungera på mobil och desktop samt ha semantisk HTML, tydliga etiketter för formulärfält, god kontrast, synligt tangentbordsfokus och logisk rubrikordning.
