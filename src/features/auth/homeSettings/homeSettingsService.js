import { isSupabaseConfigured, supabaseRequest } from "../../../lib/supabase";

export const defaultHomeSettings = {
  headingEn: "Sharp cuts.\nClean style.",
  headingAr: "\u0642\u0635\u0629 \u0645\u0645\u064a\u0632\u0629.\n\u0623\u0646\u0627\u0642\u0629 \u062a\u062f\u0648\u0645.",
  descriptionEn: "Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.",
  descriptionAr: "\u062e\u062f\u0645\u0627\u062a \u062d\u0644\u0627\u0642\u0629 \u0645\u0645\u064a\u0632\u0629 \u0644\u0644\u0631\u062c\u0644 \u0627\u0644\u0639\u0635\u0631\u064a\u060c \u0628\u062a\u062c\u0631\u0628\u0629 \u0645\u0631\u064a\u062d\u0629 \u0648\u0625\u0637\u0644\u0627\u0644\u0629 \u0623\u0646\u064a\u0642\u0629 \u062a\u062f\u0648\u0645.",
  imageUrl: "",
  rulesEn: "Booking requests are preferences. We'll confirm availability with you on WhatsApp.",
  rulesAr: "\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u062d\u062c\u0632 \u0637\u0644\u0628\u0627\u062a \u0645\u0628\u062f\u0626\u064a\u0629\u060c \u0648\u0633\u0646\u0624\u0643\u062f \u0627\u0644\u062a\u0648\u0641\u0631 \u0645\u0639\u0643 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628.",
};

const columns = "heading_en,heading_ar,description_en,description_ar,image_url,rules_en,rules_ar";
const fromRow = (row = {}) => ({
  headingEn: row.heading_en || defaultHomeSettings.headingEn,
  headingAr: row.heading_ar || defaultHomeSettings.headingAr,
  descriptionEn: row.description_en || defaultHomeSettings.descriptionEn,
  descriptionAr: row.description_ar || defaultHomeSettings.descriptionAr,
  imageUrl: row.image_url || "",
  rulesEn: row.rules_en || "",
  rulesAr: row.rules_ar || "",
});

export async function getHomeSettings() {
  if (!isSupabaseConfigured) return { ...defaultHomeSettings };
  try {
    const rows = await supabaseRequest("hadad_home_settings", `id=eq.public&select=${encodeURIComponent(columns)}`);
    return fromRow(rows?.[0] || {});
  } catch {
    // Keep the public homepage available with built-in copy until migration 010 is applied.
    return { ...defaultHomeSettings };
  }
}

export async function saveHomeSettings(settings) {
  if (!isSupabaseConfigured) throw new Error("Configure Supabase before saving Live Home settings.");
  const values = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value || "").trim()]));
  for (const key of ["headingEn", "headingAr", "descriptionEn", "descriptionAr"]) {
    if (!values[key]) throw new Error("Complete both language versions of the hero heading and description.");
    if (values[key].length > (key.startsWith("heading") ? 120 : 400)) throw new Error("Hero text is too long.");
  }
  if (values.rulesEn.length > 240 || values.rulesAr.length > 240) throw new Error("Booking rules must be 240 characters or fewer.");
  const body = {
    heading_en: values.headingEn, heading_ar: values.headingAr,
    description_en: values.descriptionEn, description_ar: values.descriptionAr,
    image_url: values.imageUrl, rules_en: values.rulesEn, rules_ar: values.rulesAr,
  };
  const rows = await supabaseRequest("hadad_home_settings", `id=eq.public&select=${encodeURIComponent(columns)}`, { method: "PATCH", body });
  if (!rows?.length) throw new Error("Live Home settings were not saved. Verify the owner account and database policies.");
  return fromRow(rows[0]);
}
