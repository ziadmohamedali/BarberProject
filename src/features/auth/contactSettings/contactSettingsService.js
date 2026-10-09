import { isSupabaseConfigured, supabaseRequest } from "../../../lib/supabase";

export const emptyContactSettings = {
  whatsappPhone: "",
  contactPhone: "",
  instagramUrl: "",
  facebookUrl: "",
  instapayAddress: "",
  instapayMobile: "",
};

const columns = "whatsapp_phone,contact_phone,instagram_url,facebook_url,instapay_address,instapay_mobile";

function normalizePhone(value, label, required = false) {
  const phone = String(value || "").trim();
  if (!phone && !required) return "";
  if (!phone || !/^\+?[0-9][0-9 ()-]{6,22}$/.test(phone)
      || phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15) {
    throw new Error(`${label} must be a valid phone number with 8 to 15 digits.`);
  }
  return phone;
}

function normalizeProfileUrl(value, label, allowedHosts) {
  const urlValue = String(value || "").trim();
  if (!urlValue) return "";

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error(`${label} must be a valid profile URL.`);
  }
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`${label} must use a secure URL from ${allowedHosts[0]}.`);
  }
  return url.href;
}

export function validateContactSettings(settings) {
  const instapayAddress = String(settings.instapayAddress || "").trim();
  if (instapayAddress.length > 120) throw new Error("InstaPay address must be 120 characters or fewer.");

  return {
    whatsappPhone: normalizePhone(settings.whatsappPhone, "WhatsApp phone", true),
    contactPhone: normalizePhone(settings.contactPhone, "Contact phone"),
    instagramUrl: normalizeProfileUrl(settings.instagramUrl, "Instagram URL", ["instagram.com", "www.instagram.com"]),
    facebookUrl: normalizeProfileUrl(settings.facebookUrl, "Facebook URL", ["facebook.com", "www.facebook.com", "m.facebook.com"]),
    instapayAddress,
    instapayMobile: normalizePhone(settings.instapayMobile, "InstaPay mobile"),
  };
}

function fromContactSettingsRow(row) {
  return {
    whatsappPhone: row.whatsapp_phone || "",
    contactPhone: row.contact_phone || "",
    instagramUrl: row.instagram_url || "",
    facebookUrl: row.facebook_url || "",
    instapayAddress: row.instapay_address || "",
    instapayMobile: row.instapay_mobile || "",
  };
}

function toContactSettingsRow(settings) {
  const validSettings = validateContactSettings(settings);
  return {
    whatsapp_phone: validSettings.whatsappPhone,
    contact_phone: validSettings.contactPhone,
    instagram_url: validSettings.instagramUrl,
    facebook_url: validSettings.facebookUrl,
    instapay_address: validSettings.instapayAddress,
    instapay_mobile: validSettings.instapayMobile,
  };
}

export async function getContactSettings() {
  if (!isSupabaseConfigured) return { ...emptyContactSettings };

  const rows = await supabaseRequest(
    "hadad_contact_settings",
    `id=eq.public&select=${encodeURIComponent(columns)}`
  );
  if (!rows?.length) throw new Error("Public contact settings are not configured in Supabase.");
  return fromContactSettingsRow(rows[0]);
}

export async function saveContactSettings(settings) {
  if (!isSupabaseConfigured) throw new Error("Configure Supabase before saving contact settings.");

  const rows = await supabaseRequest(
    "hadad_contact_settings",
    "id=eq.public&select=*",
    { method: "PATCH", body: toContactSettingsRow(settings) }
  );
  if (!rows?.length) throw new Error("Contact settings were not saved. Verify the owner account and database policies.");
  return fromContactSettingsRow(rows[0]);
}
