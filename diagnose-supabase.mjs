// Temporary public-health diagnostic. Reads .env.local and reports status codes
// without printing the configured public key.
import { readFileSync } from "node:fs";

function readEnv(path = ".env.local") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv();
const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";

console.log("URL:", url || "(missing)");
console.log("PUBLIC KEY CONFIGURED:", Boolean(key));
console.log("KEY_LOOKS_LIKE:", key.startsWith("sb_publishable_") ? "new publishable key"
  : key.startsWith("eyJ") ? "legacy JWT anon key"
  : key.startsWith("sb_secret_") ? "SECRET/SERVICE-ROLE KEY (should not be in client!)"
  : "unknown format");
console.log("=".repeat(70));

if (!url || !key) { console.log("Missing URL or KEY — cannot probe."); process.exit(0); }

async function probe(label, path, opts = {}) {
  try {
    const res = await fetch(`${url}${path}`, {
      ...opts,
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...(opts.headers || {}) },
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`\n### ${label}\n  GET ${path} -> HTTP ${res.status}`);
    if (res.status >= 400 || (json && json.message)) {
      console.log("  BODY:", text.slice(0, 400));
    } else {
      console.log("  OK", json && Array.isArray(json) ? `(array len ${json.length})` : "");
    }
    return { status: res.status, json, text };
  } catch (e) {
    console.log(`\n### ${label}\n  GET ${path} -> FETCH ERROR: ${e.message}`);
    return { status: 0, error: e.message };
  }
}

// 1) Public catalog read (anon allowed)
await probe("products (anon read)", "/rest/v1/products?select=id,name,price,is_active&limit=1");

// 2) Contact settings (anon read)
await probe("hadad_contact_settings (anon read)", "/rest/v1/hadad_contact_settings?select=id&limit=1");

