import { isSupabaseConfigured, supabaseRequest } from "../../../lib/supabase";
import { DEFAULT_WORKING_HOURS } from "../bookings/workingHours";

export const defaultHomeSettings = {
  headingEn: "Sharp cuts.\nClean style.",
  headingAr: "\u0642\u0635\u0629 \u0645\u0645\u064a\u0632\u0629.\n\u0623\u0646\u0627\u0642\u0629 \u062a\u062f\u0648\u0645.",
  descriptionEn: "Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.",
  descriptionAr: "\u062e\u062f\u0645\u0627\u062a \u062d\u0644\u0627\u0642\u0629 \u0645\u0645\u064a\u0632\u0629 \u0644\u0644\u0631\u062c\u0644 \u0627\u0644\u0639\u0635\u0631\u064a\u060c \u0628\u062a\u062c\u0631\u0628\u0629 \u0645\u0631\u064a\u062d\u0629 \u0648\u0625\u0637\u0644\u0627\u0644\u0629 \u0623\u0646\u064a\u0642\u0629 \u062a\u062f\u0648\u0645.",
  rulesEn: "Please choose a time within our working hours. Appointment times are preferences, not confirmed bookings; contact us to confirm availability.",
  rulesAr: "\u064a\u0631\u062c\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u0648\u0642\u062a \u062f\u0627\u062e\u0644 \u0633\u0627\u0639\u0627\u062a \u0639\u0645\u0644\u0646\u0627. \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u062a\u0641\u0636\u064a\u0644\u0627\u062a \u0648\u0644\u064a\u0633\u062a \u062a\u0623\u0643\u064a\u062f\u064b\u0627 \u0644\u0644\u062d\u062c\u0632\u061b \u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627 \u0644\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062a\u0648\u0641\u0631.",
  imageUrl: "",
  ...DEFAULT_WORKING_HOURS,
};

const columns = "heading_en,heading_ar,description_en,description_ar,image_url,rules_en,rules_ar";
const rulesFormat = "hadad-home-rules-v1";
const isValidTime = (value) => typeof value === "string"
  && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function normalizeTime(value, fallback) {
  return isValidTime(value) ? value : fallback;
}

function readRules(value, fallback, timeKey) {
  if (typeof value !== "string" || !value.trim()) return { message: fallback };
  if (isValidTime(value)) return { message: fallback, [timeKey]: value };
  try {
    const saved = JSON.parse(value);
    if (saved?.format === rulesFormat && typeof saved.message === "string") {
      return {
        message: saved.message,
        openingTime: isValidTime(saved.openingTime) ? saved.openingTime : undefined,
        closingTime: isValidTime(saved.closingTime) ? saved.closingTime : undefined,
      };
    }
  } catch {
    // Existing rows store plain warning text; keep it visible as-is.
  }
  return { message: value.trim() };
}

function fromRow(row = {}) {
  const englishRules = readRules(row.rules_en, defaultHomeSettings.rulesEn, "openingTime");
  const arabicRules = readRules(row.rules_ar, defaultHomeSettings.rulesAr, "closingTime");
  return {
    headingEn: row.heading_en || defaultHomeSettings.headingEn,
    headingAr: row.heading_ar || defaultHomeSettings.headingAr,
    descriptionEn: row.description_en || defaultHomeSettings.descriptionEn,
    descriptionAr: row.description_ar || defaultHomeSettings.descriptionAr,
    imageUrl: row.image_url || "",
    rulesEn: englishRules.message,
    rulesAr: arabicRules.message,
    openingTime: normalizeTime(
      englishRules.openingTime || arabicRules.openingTime,
      defaultHomeSettings.openingTime
    ),
    closingTime: normalizeTime(
      arabicRules.closingTime || englishRules.closingTime,
      defaultHomeSettings.closingTime
    ),
  };
}

function encodeRules(message, openingTime, closingTime) {
  return JSON.stringify({
    format: rulesFormat,
    message,
    openingTime,
    closingTime,
  });
}

export async function getHomeSettings() {
  if (!isSupabaseConfigured) return { ...defaultHomeSettings };
  const rows = await supabaseRequest("hadad_home_settings", `id=eq.public&select=${encodeURIComponent(columns)}`);
  if (!rows?.length) throw new Error("Public homepage settings are not configured in Supabase.");
  return fromRow(rows[0]);
}

export async function getWorkingHours() {
  if (!isSupabaseConfigured) {
    return {
      openingTime: defaultHomeSettings.openingTime,
      closingTime: defaultHomeSettings.closingTime,
    };
  }
  const rows = await supabaseRequest(
    "hadad_home_settings",
    `id=eq.public&select=${encodeURIComponent("rules_en,rules_ar")}`
  );
  const settings = fromRow(rows?.[0] || {});
  return {
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
  };
}

export async function saveHomeSettings(settings) {
  if (!isSupabaseConfigured) throw new Error("Configure Supabase before saving Live Home settings.");
  const values = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value || "").trim()]));
  for (const key of ["headingEn", "headingAr", "descriptionEn", "descriptionAr"]) {
    if (!values[key]) throw new Error("Complete both language versions of the hero heading and description.");
    if (values[key].length > (key.startsWith("heading") ? 120 : 400)) throw new Error("Hero text is too long.");
  }
  for (const key of ["rulesEn", "rulesAr"]) {
    if (!values[key]) throw new Error("Complete both language versions of the booking warning.");
    if (values[key].length > 400) throw new Error("Booking warning is too long.");
  }
  if (!isValidTime(settings.openingTime)) throw new Error("Choose a valid opening time.");
  if (!isValidTime(settings.closingTime)) throw new Error("Choose a valid closing time.");
  const body = {
    heading_en: values.headingEn, heading_ar: values.headingAr,
    description_en: values.descriptionEn, description_ar: values.descriptionAr,
    image_url: values.imageUrl,
    rules_en: encodeRules(values.rulesEn, settings.openingTime, settings.closingTime),
    rules_ar: encodeRules(values.rulesAr, settings.openingTime, settings.closingTime),
  };
  const rows = await supabaseRequest("hadad_home_settings", `id=eq.public&select=${encodeURIComponent(columns)}`, { method: "PATCH", body });
  if (!rows?.length) throw new Error("Live Home settings were not saved. Verify the owner account and database policies.");
  return fromRow(rows[0]);
}
