# HAIR NAILS – Website (Wien Neubau)

Statische One-Page-Website für den Salon **HAIR NAILS** (Neubaugasse 6, 1070 Wien).

- **Live-Demo:** `https://illyastack.github.io/HairNails-demo/`
- **Treatwell-Profil:** `https://www.treatwell.at/ort/hair-nails/`

---

## Projektstruktur

```text
├── index.html                              # Gesamte Seitenstruktur & Texte
├── styles.css                              # Design-Tokens, Layout & Responsive-Styles
├── script.js                               # Buchungs-URLs, Preis-Loader, Navigation & Scroll-Effekte
├── data/
│   └── treatwell-prices.json               # Verifizierte „ab … €“-Preise & Deep-Links für alle 5 Kategorien
├── scripts/
│   └── update-treatwell-prices.mjs         # Node-Skript zur Preis-Synchronisation von Treatwell
├── .github/
│   └── workflows/
│       └── sync-treatwell-prices.yml       # Täglicher GitHub-Actions-Job für Preis-Updates
└── assets/
    └── img/
        └── real/                           # Echte, optimierte Salonfotos (WebP)
```

---

## 1. Texte der Inhaberin anpassen

Alle sichtbaren Textblöcke in `index.html` sind klar mit HTML-Kommentaren (`<!-- [TEXT-BLOCK: ...] -->`) sowie `data-copy="..."`-Attributen gekennzeichnet:

- **Hero:** `data-copy="hero.eyebrow"`, `hero.title`, `hero.tagline`, `hero.lead`
- **Services (5 Treatwell-Kategorien):** `data-copy="services.title"` sowie `services.<kategorie>.title` und `services.<kategorie>.list` für `friseur`, `naegel`, `haarentfernung`, `gesicht`, `massage`
- **USP („Alles an einem Ort“):** `data-copy="usp.eyebrow"`, `usp.title`, `usp.copy`
- **Über uns (27+ Jahre):** `data-copy="about.eyebrow"`, `about.title`, `about.copy`, `about.statLabel`, `about.statCopy`
- **Sprachen:** `data-copy="languages.title"` sowie die `<li>`-Einträge in `.languages__list`
- **Kontakt & Öffnungszeiten:** `index.html` ab `<!-- [TEXT-BLOCK: KONTAKT] -->`

---

## 2. Treatwell-Buchungslinks (`BOOKING_URLS`)

In `script.js` werden alle allgemeinen Buchungs-Buttons (`data-booking="all"`) und die 5 Service-Karten zentral über `BOOKING_URLS` gesteuert:

```js
const BOOKING_URLS = {
  all: "https://www.treatwell.at/ort/hair-nails/",
  friseur: "https://www.treatwell.at/ort/hair-nails/?serviceIds=TR2628000&tt=6#menu",
  naegel: "https://www.treatwell.at/ort/hair-nails/?serviceIds=TR2631559&tt=36#menu",
  haarentfernung: "https://www.treatwell.at/ort/hair-nails/?serviceIds=TR2628105&tt=43#menu",
  gesicht: "https://www.treatwell.at/ort/hair-nails/?serviceIds=TR4400115&tt=4#menu",
  massage: "https://www.treatwell.at/ort/hair-nails/?serviceIds=TR2713247&tt=37#menu"
};
```

- **Alle Preise & Termine / Termin buchen (`all`):** Öffnet die allgemeine Treatwell-Salonseite (`https://www.treatwell.at/ort/hair-nails/`).
- **Kategorie-Karten (`friseur`, `naegel`, `haarentfernung`, `gesicht`, `massage`):** Nutzen die von Treatwell server- und clientseitig ausgewerteten Parameter `?serviceIds=<MultiOptionServiceId>&tt=<TreatmentCategoryGroupId>#menu`. Dadurch aktiviert Treatwell direkt den entsprechenden Kategorie-Tab (*Friseur*, *Nägel*, *Haarentfernung*, *Gesicht* bzw. *Massage*), filtert die Menügruppen unter *Alle Services* auf diese Kategorie und springt zum Menü (`#menu`), ohne bereits eine einzelne Option fest in den Warenkorb zu legen.

---

## 3. Automatische Synchronisation der „ab … €“-Preise

Die 5 Service-Karten spiegeln exakt die 5 Top-Level-Kategorien von Treatwell wider (`Friseur`: ab 15 €, `Nägel`: ab 15 €, `Haarentfernung`: ab 7 €, `Gesicht`: ab 13 €, `Massage`: ab 10 €):

1. **Fallback im HTML:** Die verifizierten Einstiegspreise stehen direkt in `index.html` (`<span class="service__price" data-price="friseur">ab 15 €</span>` usw.), sodass die Seite auch komplett ohne Server (`file://`) sofort korrekte Preise zeigt.
2. **Lokale JSON-Datei (`data/treatwell-prices.json`):** Beim Seitenaufruf lädt `script.js` die Datei `data/treatwell-prices.json` und aktualisiert alle `[data-price]`- und `[data-booking]`-Elemente.
3. **Manuelles Update ausführen (Node.js 20+):**
   ```bash
   node scripts/update-treatwell-prices.mjs
   ```
   Das Skript liest die öffentlichen Menü- und Preisdaten (`primaryTreatmentCategoryGroupId`) der Treatwell-Seite, berechnet den niedrigsten Preis je Kategorie (`friseur`, `naegel`, `haarentfernung`, `gesicht`, `massage`) und aktualisiert `data/treatwell-prices.json` nur dann, wenn sich tatsächlich etwas geändert hat.
4. **Automatischer GitHub-Actions-Workflow (`.github/workflows/sync-treatwell-prices.yml`):**
   Läuft täglich um `05:17 UTC` (sowie jederzeit manuell über *Actions → Sync Treatwell Starting Prices → Run workflow*) und committet Änderungen an `data/treatwell-prices.json` automatisch in das Repository.
