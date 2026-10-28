#!/usr/bin/env node
/**
 * Synchronizes the minimum starting prices ("ab XX €") for the 4 website service
 * categories from the public Hair-Nails Treatwell venue page into data/treatwell-prices.json.
 *
 * Safety guarantees:
 * - Never overwrites a valid existing price with an empty/invalid/NaN value.
 * - Fails safely (exits 0) if Treatwell is unreachable or changes its HTML structure.
 * - Only rewrites data/treatwell-prices.json when at least one price value actually changed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../data/treatwell-prices.json");
const TREATWELL_URL = "https://www.treatwell.at/ort/hair-nails/";

const CATEGORY_MATCHERS = {
  hair: /haar|schnitt|color|friseur|balayage|strähnen|tönung|dauerwelle|keratin/i,
  nails: /nägel|naegel|maniküre|manikuere|pediküre|pedikuere|shellac|nail/i,
  beauty: /haarentfernung|faden|brows|augenbrauen|laminierung|make-?up|gesicht|kosmetik/i,
  lashes: /wimpernverlängerung|wimpernverlaengerung|lash\s*extension|lashes/i
};

function isValidPrice(val) {
  return typeof val === "number" && Number.isFinite(val) && val > 0 && val < 1000;
}

function formatPriceLabel(price) {
  const formatted = Number.isInteger(price) ? String(price) : price.toFixed(2).replace(".", ",");
  return `ab ${formatted} €`;
}

function classifyGroupName(groupName) {
  if (!groupName) return null;
  if (CATEGORY_MATCHERS.lashes.test(groupName)) return "lashes";
  if (CATEGORY_MATCHERS.nails.test(groupName)) return "nails";
  if (CATEGORY_MATCHERS.beauty.test(groupName)) return "beauty";
  if (CATEGORY_MATCHERS.hair.test(groupName)) return "hair";
  return null;
}

function extractPricesFromWindowState(html) {
  const marker = "window.__state__ = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const scriptEndIdx = html.indexOf("</script>", startIdx);
  if (scriptEndIdx === -1) return null;

  const rawJson = html
    .slice(startIdx + marker.length, scriptEndIdx)
    .trim()
    .replace(/;$/, "");

  const state = JSON.parse(rawJson);
  const menuGroups = state?.venue?.venue?.menu?.menuGroups;
  if (!Array.isArray(menuGroups) || menuGroups.length === 0) return null;

  const mins = { hair: Infinity, nails: Infinity, beauty: Infinity, lashes: Infinity };

  for (const group of menuGroups) {
    const key = classifyGroupName(group?.name);
    if (!key || !Array.isArray(group?.menuItems)) continue;

    for (const item of group.menuItems) {
      const pr = item?.data?.priceRange;
      const rawAmount = pr?.minSalePriceAmount ?? pr?.minSeatPriceAmount;
      const num = Number.parseFloat(rawAmount);
      if (isValidPrice(num) && num < mins[key]) {
        mins[key] = num;
      }
    }
  }

  return mins;
}

function extractPricesFromJsonLd(html) {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      for (const node of graph) {
        const catalogs = node?.hasOfferCatalog?.itemListElement;
        if (!Array.isArray(catalogs)) continue;

        const mins = { hair: Infinity, nails: Infinity, beauty: Infinity, lashes: Infinity };
        for (const cat of catalogs) {
          const key = classifyGroupName(cat?.name);
          if (!key || !Array.isArray(cat?.itemListElement)) continue;
          for (const offer of cat.itemListElement) {
            const num = Number.parseFloat(offer?.price ?? offer?.lowPrice);
            if (isValidPrice(num) && num < mins[key]) {
              mins[key] = num;
            }
          }
        }
        return mins;
      }
    } catch {
      // continue scanning other JSON-LD blocks
    }
  }
  return null;
}

async function main() {
  let existingData;
  try {
    existingData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch (err) {
    console.error("[price-sync] Could not read existing data/treatwell-prices.json:", err.message);
    process.exit(0);
  }

  let html;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(TREATWELL_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "de-AT,de;q=0.9,en;q=0.8"
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[price-sync] HTTP ${res.status} from Treatwell. Keeping existing prices.`);
      process.exit(0);
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[price-sync] Network error fetching Treatwell (${err.message}). Keeping existing prices.`);
    process.exit(0);
  }

  let extracted = null;
  try {
    extracted = extractPricesFromWindowState(html);
  } catch (err) {
    console.warn("[price-sync] window.__state__ parser failed, trying JSON-LD fallback:", err.message);
  }

  if (!extracted) {
    try {
      extracted = extractPricesFromJsonLd(html);
    } catch (err) {
      console.warn("[price-sync] JSON-LD parser failed:", err.message);
    }
  }

  if (!extracted) {
    console.warn("[price-sync] No price data found on page. Preserving last known valid prices.");
    process.exit(0);
  }

  const keys = ["hair", "nails", "beauty", "lashes"];
  let changed = false;
  const nextData = { ...existingData };

  for (const key of keys) {
    const newPrice = extracted[key];
    const oldPrice = existingData?.[key]?.price;

    if (isValidPrice(newPrice)) {
      if (newPrice !== oldPrice) {
        changed = true;
        console.log(`[price-sync] ${key}: ${oldPrice} EUR -> ${newPrice} EUR`);
      } else {
        console.log(`[price-sync] ${key}: unchanged (${oldPrice} EUR)`);
      }
      nextData[key] = {
        price: newPrice,
        currency: "EUR",
        label: formatPriceLabel(newPrice)
      };
    } else {
      console.warn(`[price-sync] ${key}: extracted value invalid (${newPrice}), preserving ${oldPrice} EUR`);
    }
  }

  if (changed) {
    nextData.updatedAt = new Date().toISOString();
    nextData.source = TREATWELL_URL;
    fs.writeFileSync(DATA_PATH, JSON.stringify(nextData, null, 2) + "\n", "utf-8");
    console.log("[price-sync] Updated data/treatwell-prices.json.");
  } else {
    console.log("[price-sync] No price changes detected. File left untouched.");
  }
}

main();
