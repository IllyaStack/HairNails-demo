#!/usr/bin/env node
/**
 * HAIR NAILS – Treatwell Starting Price Synchronizer
 *
 * Fetches the public Treatwell venue page for HAIR NAILS, extracts the
 * current minimum "ab … €" price for each of the 5 top-level Treatwell
 * service categories:
 *   - friseur        (TreatmentCategoryGroup ID 6:  Friseur)
 *   - naegel         (TreatmentCategoryGroup ID 36: Nägel)
 *   - haarentfernung (TreatmentCategoryGroup ID 43: Haarentfernung)
 *   - gesicht        (TreatmentCategoryGroup ID 4:  Gesicht)
 *   - massage        (TreatmentCategoryGroup ID 37: Massage)
 *
 * Updates `data/treatwell-prices.json` only when prices actually change.
 * Fails safely (leaving existing JSON intact) if Treatwell is unreachable
 * or changes its markup structure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../data/treatwell-prices.json");
const VENUE_URL = "https://www.treatwell.at/ort/hair-nails/";

const CATEGORY_CONFIG = {
  friseur: {
    label: "Friseur",
    treatmentCategoryGroupId: 6,
    defaultServiceId: "TR2628000"
  },
  naegel: {
    label: "Nägel",
    treatmentCategoryGroupId: 36,
    defaultServiceId: "TR2631559"
  },
  haarentfernung: {
    label: "Haarentfernung",
    treatmentCategoryGroupId: 43,
    defaultServiceId: "TR2628105"
  },
  gesicht: {
    label: "Gesicht",
    treatmentCategoryGroupId: 4,
    defaultServiceId: "TR4400115"
  },
  massage: {
    label: "Massage",
    treatmentCategoryGroupId: 37,
    defaultServiceId: "TR2713247"
  }
};

const GROUP_ID_TO_KEY = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => [cfg.treatmentCategoryGroupId, key])
);

function classifyByNameFallback(itemName = "", groupName = "") {
  const item = itemName.toLowerCase();
  const group = groupName.toLowerCase();

  if (item.includes("massage") || group.includes("massage")) return "massage";
  if (item.includes("haarentfernung") || item.includes("fadentechnik") || item.includes("wax")) {
    return "haarentfernung";
  }
  if (
    group.includes("nägel") ||
    group.includes("naegel") ||
    group.includes("pediküre") ||
    item.includes("maniküre") ||
    item.includes("pediküre") ||
    item.includes("shellac") ||
    item.includes("gel")
  ) {
    return "naegel";
  }
  if (
    group.includes("wimpern") ||
    group.includes("laminierung") ||
    group.includes("makeup") ||
    item.includes("wimpern") ||
    item.includes("augenbrauen") ||
    item.includes("make-up") ||
    item.includes("laminierung") ||
    (group.includes("haarentfernung und färben") && item.includes("färben"))
  ) {
    return "gesicht";
  }
  if (
    group.includes("haarschnitt") ||
    group.includes("coloration") ||
    item.includes("haarschnitt") ||
    item.includes("föhnen") ||
    item.includes("strähnen") ||
    item.includes("balayage")
  ) {
    return "friseur";
  }
  return null;
}

function extractItemMinPrice(itemData) {
  const candidates = [];

  const saleAmt = Number(itemData?.priceRange?.minSalePrice?.salePriceAmount);
  if (Number.isFinite(saleAmt) && saleAmt > 0) candidates.push(saleAmt);

  const minAmt = Number(itemData?.priceRange?.minPrice?.priceAmount);
  if (Number.isFinite(minAmt) && minAmt > 0) candidates.push(minAmt);

  if (Array.isArray(itemData?.optionGroups)) {
    for (const og of itemData.optionGroups) {
      for (const opt of og?.options || []) {
        const p = Number(opt?.salePrice?.salePriceAmount ?? opt?.price?.priceAmount);
        if (Number.isFinite(p) && p > 0) candidates.push(p);
      }
    }
  }

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function parseFromWindowState(html) {
  const marker = "window.__state__ = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + marker.length;
  const endIdx = html.indexOf(";</script>", jsonStart);
  if (endIdx === -1) return null;

  const rawJson = html.slice(jsonStart, endIdx).trim();
  const state = JSON.parse(rawJson);
  const menuGroups = state?.venue?.venue?.menu?.menuGroups;
  if (!Array.isArray(menuGroups) || menuGroups.length === 0) return null;

  const buckets = {
    friseur: { prices: [], groups: new Set(), serviceIds: [] },
    naegel: { prices: [], groups: new Set(), serviceIds: [] },
    haarentfernung: { prices: [], groups: new Set(), serviceIds: [] },
    gesicht: { prices: [], groups: new Set(), serviceIds: [] },
    massage: { prices: [], groups: new Set(), serviceIds: [] }
  };

  for (const group of menuGroups) {
    const groupName = group?.name || "";
    for (const item of group?.menuItems || []) {
      const d = item?.data;
      if (!d) continue;

      const catGroupId = Number(d.primaryTreatmentCategoryGroupId);
      const key =
        GROUP_ID_TO_KEY[catGroupId] || classifyByNameFallback(d.name || "", groupName);
      if (!key || !buckets[key]) continue;

      const minPrice = extractItemMinPrice(d);
      if (minPrice !== null) {
        buckets[key].prices.push(minPrice);
        buckets[key].groups.add(groupName);
      }

      // Prefer multi-optionGroup serviceIds for category deep-linking so Treatwell
      // activates the category tab without pre-locking a single option into the cart.
      if (d.id && Array.isArray(d.optionGroups) && d.optionGroups.length > 1) {
        buckets[key].serviceIds.push(d.id);
      }
    }
  }

  return buckets;
}

function parseFromJsonLd(html) {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  const buckets = {
    friseur: { prices: [], groups: new Set(), serviceIds: [] },
    naegel: { prices: [], groups: new Set(), serviceIds: [] },
    haarentfernung: { prices: [], groups: new Set(), serviceIds: [] },
    gesicht: { prices: [], groups: new Set(), serviceIds: [] },
    massage: { prices: [], groups: new Set(), serviceIds: [] }
  };

  while ((match = regex.exec(html)) !== null) {
    try {
      const ld = JSON.parse(match[1]);
      const catalogs = ld?.hasOfferCatalog?.itemListElement;
      if (!Array.isArray(catalogs)) continue;

      for (const cat of catalogs) {
        const groupName = cat?.name || "";
        for (const offer of cat?.itemListElement || []) {
          const itemName = offer?.itemOffered?.name || "";
          const key = classifyByNameFallback(itemName, groupName);
          if (!key || !buckets[key]) continue;

          const p = Number(offer?.lowPrice ?? offer?.price);
          if (Number.isFinite(p) && p > 0) {
            buckets[key].prices.push(p);
            buckets[key].groups.add(groupName);
          }
        }
      }
    } catch {
      // ignore unrelated JSON-LD blocks
    }
  }

  return buckets;
}

function formatEuro(val) {
  return Number.isInteger(val) ? `ab ${val} €` : `ab ${val.toFixed(2).replace(".", ",")} €`;
}

async function main() {
  let existingData = null;
  if (fs.existsSync(DATA_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (err) {
      console.warn("[price-sync] Warning: could not parse existing JSON:", err.message);
    }
  }

  let html;
  try {
    const res = await fetch(VENUE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "de-AT,de;q=0.9,en;q=0.8"
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      console.error(`[price-sync] HTTP ${res.status} from Treatwell. Keeping existing prices.`);
      process.exit(0);
    }
    html = await res.text();
  } catch (err) {
    console.error(`[price-sync] Network error fetching Treatwell: ${err.message}. Keeping existing prices.`);
    process.exit(0);
  }

  let buckets = null;
  try {
    buckets = parseFromWindowState(html);
  } catch (err) {
    console.warn(`[price-sync] window.__state__ parse failed (${err.message}), trying JSON-LD fallback...`);
  }

  if (!buckets) {
    buckets = parseFromJsonLd(html);
  }

  const requiredKeys = Object.keys(CATEGORY_CONFIG);
  const nextPrices = {};

  for (const key of requiredKeys) {
    const cfg = CATEGORY_CONFIG[key];
    const b = buckets?.[key];
    if (!b || !Array.isArray(b.prices) || b.prices.length === 0) {
      console.error(
        `[price-sync] Missing valid price data for category "${key}". Aborting update to preserve last known valid prices.`
      );
      process.exit(0);
    }

    const minVal = Math.min(...b.prices);
    if (!Number.isFinite(minVal) || minVal <= 0 || minVal > 1000) {
      console.error(`[price-sync] Implausible minimum price (${minVal}) for "${key}". Aborting update.`);
      process.exit(0);
    }

    const rounded = Number.isInteger(minVal) ? minVal : Number(minVal.toFixed(2));
    const repServiceId =
      b.serviceIds.includes(cfg.defaultServiceId)
        ? cfg.defaultServiceId
        : b.serviceIds[0] || cfg.defaultServiceId;

    nextPrices[key] = {
      label: cfg.label,
      treatmentCategoryGroupId: cfg.treatmentCategoryGroupId,
      fromPrice: rounded,
      formatted: formatEuro(rounded),
      bookingUrl: `${VENUE_URL}?serviceIds=${repServiceId}&tt=${cfg.treatmentCategoryGroupId}#menu`,
      sourceGroups: Array.from(b.groups)
    };
  }

  let hasChanged = !existingData || !existingData.prices;
  if (!hasChanged) {
    for (const key of requiredKeys) {
      const oldPrice = existingData.prices?.[key]?.fromPrice;
      const newPrice = nextPrices[key].fromPrice;
      const oldUrl = existingData.prices?.[key]?.bookingUrl;
      const newUrl = nextPrices[key].bookingUrl;
      if (oldPrice !== newPrice || oldUrl !== newUrl) {
        hasChanged = true;
        console.log(`[price-sync] ${key}: ${oldPrice} EUR -> ${newPrice} EUR (${newUrl})`);
      } else {
        console.log(`[price-sync] ${key}: unchanged (${newPrice} EUR)`);
      }
    }
  }

  if (!hasChanged) {
    console.log("[price-sync] No price changes detected. File left untouched.");
    return;
  }

  const payload = {
    venueId: 382206,
    venueUrl: VENUE_URL,
    currency: "EUR",
    updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    prices: nextPrices
  };

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`[price-sync] Updated ${DATA_FILE} successfully.`);
}

main();
