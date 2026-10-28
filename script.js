/* =========================================================
   HAIR NAILS – Script
   ========================================================= */

/* ▸ Booking-Links zentral konfigurieren:
   Falls die Inhaberin später separate Treatwell-Connect-Widget-Links
   für einzelne Kategorien bereitstellt, hier einfach eintragen. */
const BOOKING_URLS = {
  all: "https://www.treatwell.at/ort/hair-nails/",
  hair: "https://www.treatwell.at/ort/hair-nails/",
  nails: "https://www.treatwell.at/ort/hair-nails/",
  beauty: "https://www.treatwell.at/ort/hair-nails/",
  lashes: "https://www.treatwell.at/ort/hair-nails/"
};

document.documentElement.classList.add("js");

document.querySelectorAll("[data-booking]").forEach((a) => {
  const key = a.dataset.booking || "all";
  a.href = BOOKING_URLS[key] || BOOKING_URLS.all;
});

/* ---------- Ab-Preise aus lokaler JSON-Datei laden ----------
   Fallback-Werte stehen bereits direkt im HTML (ab 10 €, ab 15 €, ab 7 €, ab 65 €),
   sodass die Anzeige auch ohne Fetch (z. B. via file://) sofort funktioniert. */
async function loadTreatwellPrices() {
  try {
    const res = await fetch("data/treatwell-prices.json", { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.prices) return;

    document.querySelectorAll("[data-price]").forEach((el) => {
      const key = el.dataset.price;
      const entry = data.prices[key];
      const val = typeof entry === "number" ? entry : entry && entry.fromPrice;
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        el.textContent = `ab ${val} €`;
      }
    });
  } catch {
    /* Fallback im HTML bleibt unverändert bestehen */
  }
}
loadTreatwellPrices();

/* ---------- Sticky nav state ---------- */
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 10);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------- Mobile menu ---------- */
const toggle = document.getElementById("navToggle");
const menu = document.getElementById("mobileMenu");

const setMenu = (open) => {
  document.body.classList.toggle("menu-open", open);
  document.body.classList.toggle("is-locked", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  menu.setAttribute("aria-hidden", String(!open));
};

toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => e.matches && setMenu(false));

/* ---------- Reveal on scroll ---------- */
const reveals = document.querySelectorAll(".reveal");

// small stagger for siblings in grids
document.querySelectorAll(".services, .proof__grid, .gallery, .hero__text").forEach((group) => {
  group.querySelectorAll(":scope > .reveal").forEach((el, i) => el.style.setProperty("--d", `${i * 0.08}s`));
});

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}

/* ---------- Sticky mobile CTA ----------
   Visible after the hero; hidden while the contact section or footer
   is on screen (they already contain booking buttons). */
const cta = document.getElementById("mobileCta");
const hero = document.querySelector(".hero");
const hideZones = [document.getElementById("kontakt"), document.getElementById("footer")];
const state = { pastHero: false, inHideZone: new Set() };

const updateCta = () =>
  cta.classList.toggle("is-visible", state.pastHero && state.inHideZone.size === 0);

if ("IntersectionObserver" in window) {
  new IntersectionObserver(([e]) => {
    state.pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
    updateCta();
  }, { threshold: 0, rootMargin: "-40% 0px 0px 0px" }).observe(hero);

  const zoneObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? state.inHideZone.add(e.target) : state.inHideZone.delete(e.target)));
    updateCta();
  }, { threshold: 0.08 });
  hideZones.forEach((z) => z && zoneObserver.observe(z));
}

/* ---------- Highlight today's opening hours ---------- */
const today = new Date().getDay();
document.querySelectorAll("#hours [data-days]").forEach((row) => {
  if (row.dataset.days.split(",").map(Number).includes(today)) row.classList.add("is-today");
});

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();
