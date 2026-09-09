# TimeToTalk

TimeToTalk är en bokningsapplikation för muntliga förhör eller redovisningar.

## Tekniker

- HTML och EJS
- CSS och Bootstrap
- JavaScript
- Express
- Nodemon
- SQLite

## Starta projektet

Första gången projektet öppnas:

```bash
npm install
npm run dev
```

Öppna sedan:

http://localhost:3000

Nästa gång projektet öppnas räcker det normalt med:

```bash
npm run dev
```

Stoppa servern med `Ctrl + C`.

## Projektstruktur

- `views` – projektets EJS-sidor
- `views/partials` – gemensamma delar som återanvänds
- `routes` – Express-routes
- `public/stylesheets` – gemensam CSS
- `public/javascripts` – JavaScript som körs i webbläsaren
- `public/images` – bilder
- `app.js` – startar och konfigurerar Express

Alla sidor ska inkludera `partials/head` för att få Bootstrap, gemensam CSS, korrekt sidtitel och mobilinställningar.

## Arbeta med Git

Arbeta inte direkt i `main`. Hämta först senaste versionen och skapa sedan en egen branch:

```bash
git switch main
git pull
git switch -c typ/kort-beskrivning
```

Exempel:

```text
funktion/inloggning
funktion/lediga-tider
design/dashboard
```

Alla commit-meddelanden skrivs på svenska.

## Tillgänglighet

TimeToTalk utvecklas med WCAG 2.2 nivå AA som mål. Sidorna ska fungera på mobil och desktop samt ha semantisk HTML, tydliga labels, god kontrast, synligt tangentbordsfokus och logisk rubrikordning.
