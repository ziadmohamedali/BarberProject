import sampleProducts from "../features/auth/products/productData";

const PRODUCT_KEY = "hadad-products-v1";
const BOOKING_KEY = "hadad-bookings-v1";

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage write failures in restricted browsers.
  }
}

function normalizeProduct(product) {
  return {
    ...product,
    id: product.id ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category: product.category === "package" ? "package" : "haircut",
    active: product.active !== false,
    oldPrice: product.oldPrice === "" || product.oldPrice == null ? null : Number(product.oldPrice),
    price: Number(product.price),
    duration: product.duration === "" || product.duration == null ? "" : Number(product.duration),
    gallery: Array.isArray(product.gallery) ? product.gallery.filter(Boolean).slice(0, 4) : [],
  };
}

function seededProducts() {
  const items = Array.isArray(sampleProducts) ? sampleProducts : [];
  return items.map((product) => normalizeProduct(product));
}

function ensureProducts() {
  const products = safeRead(PRODUCT_KEY, null);
  if (Array.isArray(products) && products.length > 0) return products;
  const initial = seededProducts();
  safeWrite(PRODUCT_KEY, initial);
  return initial;
}

export function getLocalProducts({ owner = false } = {}) {
  const products = ensureProducts();
  return owner ? products : products.filter((product) => product.active !== false);
}

export function createLocalProduct(product) {
  const products = ensureProducts();
  const created = normalizeProduct({
    ...product,
    id: product.id ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sortOrder: products.length,
  });
  const next = [...products, created];
  safeWrite(PRODUCT_KEY, next);
  return created;
}

export function updateLocalProduct(product) {
  const products = ensureProducts();
  const next = products.map((existing) => existing.id === product.id ? normalizeProduct(product) : existing);
  if (!next.some((item) => item.id === product.id)) throw new Error("Product was not found or the database rejected the change.");
  safeWrite(PRODUCT_KEY, next);
  return next.find((item) => item.id === product.id);
}

export function deleteLocalProduct(productId) {
  const products = ensureProducts();
  const next = products.filter((product) => product.id !== productId);
  safeWrite(PRODUCT_KEY, next);
}

export function readLocalBookings() {
  const bookings = safeRead(BOOKING_KEY, []);
  return Array.isArray(bookings) ? bookings : [];
}

export function createLocalBooking(booking) {
  const existing = readLocalBookings();
  const created = {
    ...booking,
    id: booking.id ?? `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: booking.createdAt ?? new Date().toISOString(),
  };
  const next = [created, ...existing];
  safeWrite(BOOKING_KEY, next);
  return created;
}

export function updateLocalBooking(id, field, value) {
  const bookings = readLocalBookings();
  const next = bookings.map((booking) => booking.id === id ? { ...booking, [field]: value } : booking);
  if (!next.some((booking) => booking.id === id)) throw new Error("Booking was not found or the database rejected the change.");
  safeWrite(BOOKING_KEY, next);
  return next.find((booking) => booking.id === id);
}

export async function fileToDataUrl(file) {
  if (!file) throw new Error("Choose an image file first.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read. Please try another file."));
    reader.readAsDataURL(file);
  });
}
