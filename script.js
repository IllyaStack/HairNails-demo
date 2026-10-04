/* =========================================================
   HAIR NAILS – Demo Script
   ========================================================= */

/* ▸ Booking-Link zentral – alle "Termin buchen"-Buttons nutzen diese URL */
const BOOKING_URL = "https://www.treatwell.at/ort/hair-nails/";

document.documentElement.classList.add("js");

document.querySelectorAll("[data-booking]").forEach((a) => (a.href = BOOKING_URL));

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
  }, { threshold: 0.25 });
  hideZones.forEach((z) => z && zoneObserver.observe(z));
}

/* ---------- Highlight today's opening hours ---------- */
const today = new Date().getDay();
document.querySelectorAll("#hours [data-days]").forEach((row) => {
  if (row.dataset.days.split(",").map(Number).includes(today)) row.classList.add("is-today");
});

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();
