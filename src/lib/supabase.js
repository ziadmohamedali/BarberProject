const environment = import.meta.env || {};
const configuredUrl = environment.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY?.trim();

try {
  window.sessionStorage.removeItem("hadad-owner-session");
  window.localStorage.removeItem("hadad-supabase-session");
  window.localStorage.removeItem("hadad-pending-appointment");
  window.localStorage.removeItem("hadad-bookings-v1");
  window.localStorage.removeItem("hadad-products-v1");
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("hadad-confirmation-")) window.localStorage.removeItem(key);
  }
} catch {
  // Keep the app usable when browser storage is restricted.
}

function isValidSupabaseUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.host);
  } catch {
    return false;
  }
}

const supabaseUrl = isValidSupabaseUrl(configuredUrl) ? configuredUrl : "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

async function request(path, { method = "GET", body, headers = {} } = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set a valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then reload the app.");
  }
  const isBinaryBody = typeof Blob !== "undefined" && body instanceof Blob;
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      ...(body === undefined ? {} : isBinaryBody
        ? { "Content-Type": body.type || "application/octet-stream" }
        : { "Content-Type": "application/json", Prefer: "return=representation" }),
      ...headers,
    },
    body: body === undefined ? undefined : isBinaryBody ? body : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || data?.error || data?.hint;
    const details = data?.details && data.details !== message ? ` ${data.details}` : "";
    const error = new Error(`${message || `Supabase request failed (${response.status}).`}${details}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function supabaseRequest(table, query = "", options = {}) {
  return request(`/rest/v1/${table}${query ? `?${query}` : ""}`, options);
}

export async function validateProductImageFile(file) {
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[file?.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size <= 0) throw new Error("Choose an image file that is not empty.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...bytes) => bytes.every((byte, index) => signature[index] === byte);
  const isValidImage = file.type === "image/jpeg"
    ? startsWith(0xff, 0xd8, 0xff)
    : file.type === "image/png"
      ? startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      : signature.length >= 12
        && new TextDecoder().decode(signature.slice(0, 4)) === "RIFF"
        && new TextDecoder().decode(signature.slice(8, 12)) === "WEBP";
  if (!isValidImage) throw new Error("The selected file does not contain a supported image.");
  return extension;
}

export async function uploadStorageImage(file, onProgress = () => {}) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const extension = await validateProductImageFile(file);
  const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/product-images/${objectPath}`);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new Error("Image upload failed. Check your internet connection and try again."));
    xhr.onabort = () => reject(new Error("Image upload was cancelled."));
    xhr.onload = () => {
      let result = null;
      try { result = JSON.parse(xhr.responseText); } catch { /* Supabase can return an empty response. */ }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(result?.message || result?.error || `Image upload failed (${xhr.status}).`);
        error.status = xhr.status;
        reject(error);
        return;
      }
      onProgress(100);
      resolve();
    };
    xhr.send(file);
  });
  return `${supabaseUrl}/storage/v1/object/public/product-images/${objectPath}`;
}

export async function deleteStorageImages(imageUrls) {
  const urlPrefix = `${supabaseUrl}/storage/v1/object/public/product-images/`;
  const paths = [...new Set(imageUrls.map((imageUrl) => {
    let parsed;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return null;
    }
    if (parsed.origin !== new URL(supabaseUrl).origin || !parsed.href.startsWith(urlPrefix)) return null;

    let path;
    try {
      path = decodeURIComponent(parsed.href.slice(urlPrefix.length));
    } catch {
      return null;
    }
    if (!path || path.split("/").some((part) => !part || part === "." || part === ".." || part.includes("\\"))) return null;
    return path;
  }).filter(Boolean))];
  if (!paths.length) return;

  await request("/storage/v1/object/product-images", {
    method: "DELETE",
    body: { prefixes: paths },
  });
}
