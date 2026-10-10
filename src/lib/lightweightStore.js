import sampleProducts from "../features/auth/products/productData";

let previewProducts = null;
let previewBookings = [];

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
  if (!Array.isArray(previewProducts)) previewProducts = seededProducts();
  return previewProducts;
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
  previewProducts = next;
  return created;
}

export function updateLocalProduct(product) {
  const products = ensureProducts();
  const next = products.map((existing) => existing.id === product.id ? normalizeProduct(product) : existing);
  if (!next.some((item) => item.id === product.id)) throw new Error("Product was not found or the database rejected the change.");
  previewProducts = next;
  return next.find((item) => item.id === product.id);
}

export function deleteLocalProduct(productId) {
  const products = ensureProducts();
  const next = products.filter((product) => product.id !== productId);
  previewProducts = next;
}

export function readLocalBookings() {
  return previewBookings;
}

export function createLocalBooking(booking) {
  const existing = readLocalBookings();
  const created = {
    ...booking,
    id: booking.id ?? `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: booking.createdAt ?? new Date().toISOString(),
  };
  const next = [created, ...existing];
  previewBookings = next;
  return created;
}

export function updateLocalBooking(id, field, value) {
  const bookings = readLocalBookings();
  const next = bookings.map((booking) => booking.id === id ? { ...booking, [field]: value } : booking);
  if (!next.some((booking) => booking.id === id)) throw new Error("Booking was not found or the database rejected the change.");
  previewBookings = next;
  return next.find((booking) => booking.id === id);
}

export async function fileToDataUrl(file, onProgress = () => {}) {
  if (!file) throw new Error("Choose an image file first.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read. Please try another file."));
    reader.readAsDataURL(file);
  });
}
