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
│   └── treatwell-prices.json               # Verifizierte „ab … €“-Preise pro Service-Kategorie
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
- **Services:** `data-copy="services.title"`, `services.hair.title`, `services.hair.list` (analog für `nails`, `beauty`, `lashes`)
- **USP („Alles an einem Ort“):** `data-copy="usp.eyebrow"`, `usp.title`, `usp.copy`
- **Über uns (27+ Jahre):** `data-copy="about.eyebrow"`, `about.title`, `about.copy`, `about.statLabel`, `about.statCopy`
- **Sprachen:** `data-copy="languages.title"` sowie die `<li>`-Einträge in `.languages__list`
- **Kontakt & Öffnungszeiten:** `index.html` ab `<!-- [TEXT-BLOCK: KONTAKT] -->`

---

## 2. Treatwell-Buchungslinks (`BOOKING_URLS`)

In `script.js` werden alle Buchungs-Buttons und Service-Karten zentral über `BOOKING_URLS` gesteuert:

```js
const BOOKING_URLS = {
  all: "https://www.treatwell.at/ort/hair-nails/",
  hair: "https://www.treatwell.at/ort/hair-nails/",
  nails: "https://www.treatwell.at/ort/hair-nails/",
  beauty: "https://www.treatwell.at/ort/hair-nails/",
  lashes: "https://www.treatwell.at/ort/hair-nails/"
};
```

- Da die öffentliche Treatwell-Marketplace-Seite (`/ort/hair-nails/`) keine stabilen Deep-Link-Anker oder URL-Parameter für einzelne Kategorien anbietet, verweisen aktuell alle 4 Service-Karten zuverlässig auf die Hauptseite.
- Sobald die Inhaberin über Treatwell Connect eigene Kategorie-Widget-Links bereitstellt, müssen diese lediglich in `BOOKING_URLS` eingetragen werden.

---

## 3. Automatische Synchronisation der „ab … €“-Preise

Die 4 Service-Karten zeigen den jeweiligen Einstiegspreis („ab 10 €“, „ab 15 €“, „ab 7 €“, „ab 65 €“) an:

1. **Fallback im HTML:** Die aktuellen Einstiegspreise stehen direkt in `index.html` (`<span class="service__price" data-price="hair">ab 10 €</span>`), sodass die Seite auch komplett ohne Server (`file://`) sofort korrekte Preise zeigt.
2. **Lokale JSON-Datei (`data/treatwell-prices.json`):** Beim Seitenaufruf lädt `script.js` die Datei `data/treatwell-prices.json` und aktualisiert alle `[data-price]`-Elemente.
3. **Manuelles Update ausführen (Node.js 20+):**
   ```bash
   node scripts/update-treatwell-prices.mjs
   ```
   Das Skript liest die öffentlichen Menü- und Preisdaten der Treatwell-Seite, berechnet den niedrigsten Preis je Kategorie (`hair`, `nails`, `beauty`, `lashes`) und aktualisiert `data/treatwell-prices.json` nur dann, wenn sich tatsächlich ein Preis geändert hat. Schlägt der Abruf fehl, bleiben die bestehenden Preise unverändert erhalten.
4. **Automatischer GitHub-Actions-Workflow (`.github/workflows/sync-treatwell-prices.yml`):**
   Läuft täglich um `05:17 UTC` (sowie jederzeit manuell über *Actions → Sync Treatwell Starting Prices → Run workflow*) und committet Änderungen an `data/treatwell-prices.json` automatisch in das Repository.
