const environment = import.meta.env || {};
const configuredUrl = environment.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY?.trim();
const ownerSessionKey = "hadad-owner-session";
let inMemorySession = null;

try {
  // Owner sessions used to live in tab-scoped storage; they now persist in localStorage.
  window.sessionStorage.removeItem(ownerSessionKey);
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

function readSession() {
  try { return JSON.parse(window.localStorage.getItem(ownerSessionKey) || "null"); }
  catch { return inMemorySession; }
}

function saveSession(session) {
  try {
    if (session) window.localStorage.setItem(ownerSessionKey, JSON.stringify(session));
    else window.localStorage.removeItem(ownerSessionKey);
  } catch { /* Auth remains available in memory only if browser storage is unavailable. */ }
  inMemorySession = session || null;
}

async function request(path, { method = "GET", body, token, publicOnly = false, headers = {} } = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set a valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then reload the app.");
  }
  const storedSession = token || publicOnly ? null : readSession();
  const isBinaryBody = typeof Blob !== "undefined" && body instanceof Blob;
  let activeToken = token || storedSession?.access_token || "";
  const send = () => fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...(body === undefined ? {} : isBinaryBody
        ? { "Content-Type": body.type || "application/octet-stream" }
        : { "Content-Type": "application/json", Prefer: "return=representation" }),
      ...headers,
    },
    body: body === undefined ? undefined : isBinaryBody ? body : JSON.stringify(body),
  });
  let response = await send();
  if (response.status === 401 && storedSession?.refresh_token) {
    try {
      const refreshed = await authApi.refreshSession(storedSession.refresh_token);
      activeToken = refreshed.access_token;
      response = await send();
    } catch {
      // The stored session can no longer be refreshed; retry as a public visitor.
      saveSession(null);
      activeToken = "";
      response = await send();
    }
  }
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

export const authApi = {
  async getSession() {
    const session = readSession();
    if (!session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 <= Date.now() && session.refresh_token) {
      try {
        return await this.refreshSession(session.refresh_token);
      } catch {
        saveSession(null);
        return null;
      }
    }
    return session;
  },
  async signInWithPassword(email, password) {
    const session = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
      publicOnly: true,
    });
    session.expires_at = Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
    saveSession(session);
    return session;
  },
  async refreshSession(refreshToken) {
    const session = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: refreshToken },
      publicOnly: true,
    });
    session.expires_at = Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
    saveSession(session);
    return session;
  },
  async signOut() {
    const session = readSession();
    try {
      if (session?.access_token) {
        await request("/auth/v1/logout", { method: "POST", token: session.access_token });
      }
    } finally {
      saveSession(null);
    }
  },
  async getUser(session) {
    if (!session?.access_token) return null;
    const result = await request("/auth/v1/user", { token: session.access_token });
    return result?.id ? result : null;
  },
  async verifyOwner(session) {
    const result = await request("/rest/v1/rpc/is_hadad_owner", {
      method: "POST",
      body: {},
      token: session?.access_token,
    });
    return result === true;
  },
  async updatePassword(password) {
    const session = readSession();
    if (!session?.access_token) throw new Error("Your owner session has expired. Please log in again.");
    return request("/auth/v1/user", {
      method: "PUT",
      body: { password },
      token: session.access_token,
    });
  },
  async requestPasswordReset(email, redirectTo) {
    await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      body: { email },
      publicOnly: true,
    });
  },
  // Supabase sends the recovery link back with the session in the URL fragment.
  // Store that session, strip the fragment, and report whether this was a recovery visit.
  consumeRecoveryRedirect() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (!params.has("access_token") && !params.has("error_description")) return null;
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    if (params.get("error_description")) {
      return { error: params.get("error_description").replace(/\+/g, " ") };
    }
    if (params.get("type") !== "recovery") return null;
    const expiresIn = Number(params.get("expires_in") || 3600);
    saveSession({
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      token_type: params.get("token_type") || "bearer",
      expires_in: expiresIn,
      expires_at: Number(params.get("expires_at")) || Math.floor(Date.now() / 1000) + expiresIn,
    });
    return { recovery: true };
  },
};

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
  const uploadWithSession = (session) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/product-images/${objectPath}`);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    if (session?.access_token) xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
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
  const session = await authApi.getSession();
  try {
    await uploadWithSession(session);
  } catch (error) {
    if (error.status === 401 && session?.refresh_token) {
      const refreshed = await authApi.refreshSession(session.refresh_token);
      await uploadWithSession(refreshed);
    } else {
      throw error;
    }
  }
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
