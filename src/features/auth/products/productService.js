import { isSupabaseConfigured, supabaseRequest, uploadStorageImage, deleteStorageImages, validateProductImageFile } from "../../../lib/supabase";
import { createLocalProduct, deleteLocalProduct, fileToDataUrl, getLocalProducts, updateLocalProduct } from "../../../lib/lightweightStore";

export const uploadProductImage = async (file) => {
  if (!isSupabaseConfigured) {
    await validateProductImageFile(file);
    return fileToDataUrl(file);
  }
  return uploadStorageImage(file);
};

const columns = "id,name,description,price,old_price,category,is_active,duration_minutes,image_url,gallery_images,display_order,created_at,updated_at";

export function fromProductRow(row) {
  return {
    id: row.id,
    title: row.name,
    description: row.description,
    price: Number(row.price),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    category: row.category,
    active: row.is_active,
    duration: row.duration_minutes ?? "",
    picture: row.image_url || "",
    gallery: Array.isArray(row.gallery_images) ? row.gallery_images : [],
    sortOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateProduct(product) {
  if (typeof product.title !== "string" || !product.title.trim()) throw new Error("Product title is required.");
  if (product.title.trim().length > 30) throw new Error("Product title must be 30 characters or fewer.");
  if (typeof product.description !== "string" || !product.description.trim()) throw new Error("Product description is required.");
  if (!Number.isInteger(Number(product.price)) || Number(product.price) <= 0) throw new Error("Price must be a positive whole number.");
  if (!["haircut", "package"].includes(product.category)) throw new Error("Choose a valid product category.");
  if (typeof product.picture !== "string" || !product.picture.trim()) throw new Error("Upload a main product image before saving.");
  if (product.gallery != null && !Array.isArray(product.gallery)) throw new Error("Product images are invalid.");
  const gallery = (product.gallery || []).filter(Boolean);
  if (gallery.some((image) => typeof image !== "string")) throw new Error("Product images are invalid.");
  if (gallery.length > 4) throw new Error("Products can have up to four additional images.");

  const oldPrice = product.oldPrice === "" || product.oldPrice == null ? null : Number(product.oldPrice);
  if (oldPrice !== null && (!Number.isInteger(oldPrice) || oldPrice <= Number(product.price))) {
    throw new Error("Old price must be a whole number greater than the current price.");
  }

  const duration = product.duration === "" || product.duration == null ? null : Number(product.duration);
  if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
    throw new Error("Duration must be a positive whole number of minutes.");
  }
}

function toProductRow(product) {
  validateProduct(product);
  return {
    name: product.title.trim(),
    description: product.description.trim(),
    price: Number(product.price),
    old_price: product.oldPrice === "" || product.oldPrice == null ? null : Number(product.oldPrice),
    category: product.category,
    is_active: product.active !== false,
    duration_minutes: product.duration === "" || product.duration == null ? null : Number(product.duration),
    image_url: product.picture,
    gallery_images: (product.gallery || []).filter(Boolean).slice(0, 4),
    display_order: Number(product.sortOrder ?? 0),
  };
}

function productImageUrls(row) {
  return [row.image_url, ...(Array.isArray(row.gallery_images) ? row.gallery_images : [])].filter(Boolean);
}

async function removeUnusedProductImages(candidates) {
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  if (!uniqueCandidates.length) return;

  const rows = await supabaseRequest("products", "select=image_url,gallery_images");
  const referenced = new Set((rows || []).flatMap(productImageUrls));
  const unused = uniqueCandidates.filter((url) => !referenced.has(url));
  if (unused.length) await deleteStorageImages(unused);
}

export async function getProducts({ owner = false } = {}) {
  if (!isSupabaseConfigured) return getLocalProducts({ owner });

  const filters = [
    `select=${encodeURIComponent(columns)}`,
    `order=${encodeURIComponent("display_order.asc,created_at.asc")}`,
  ];
  if (!owner) filters.push("is_active=eq.true");
  const rows = await supabaseRequest("products", filters.join("&"));
  return (rows || []).map(fromProductRow);
}

export async function createProduct(product) {
  if (!isSupabaseConfigured) return createLocalProduct(product);

  const rows = await supabaseRequest("products", "select=*", {
    method: "POST",
    body: toProductRow(product),
  });
  if (!rows?.length) throw new Error("Supabase did not return the saved product. Check the products table and access policies.");
  return fromProductRow(rows[0]);
}

export async function updateProduct(product) {
  if (!isSupabaseConfigured) return updateLocalProduct(product);

  const previousRows = await supabaseRequest(
    "products",
    `id=eq.${encodeURIComponent(product.id)}&select=id,image_url,gallery_images`
  );
  if (!previousRows?.length) throw new Error("Product was not found.");

  const rows = await supabaseRequest("products", `id=eq.${encodeURIComponent(product.id)}&select=*`, {
    method: "PATCH",
    body: toProductRow(product),
  });
  if (!rows?.length) throw new Error("Product was not found or the database rejected the change.");

  const saved = fromProductRow(rows[0]);
  const previousImages = productImageUrls(previousRows[0]);
  const retainedImages = new Set([saved.picture, ...saved.gallery].filter(Boolean));
  try {
    await removeUnusedProductImages(previousImages.filter((url) => !retainedImages.has(url)));
  } catch (error) {
    throw new Error(`Product changes were saved, but replaced images could not be cleaned up: ${error.message}`);
  }
  return saved;
}

export async function deleteProduct(id) {
  if (!isSupabaseConfigured) {
    deleteLocalProduct(id);
    return;
  }

  const previousRows = await supabaseRequest(
    "products",
    `id=eq.${encodeURIComponent(id)}&select=id,image_url,gallery_images`
  );
  if (!previousRows?.length) throw new Error("Product was not found.");

  const deletedRows = await supabaseRequest("products", `id=eq.${encodeURIComponent(id)}&select=id`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!deletedRows?.length) throw new Error("Product was not found or the database rejected the deletion.");

  try {
    await removeUnusedProductImages(productImageUrls(previousRows[0]));
  } catch (error) {
    throw new Error(`Product was deleted, but its unused images could not be cleaned up: ${error.message}`);
  }
}

export async function deleteUnusedProductImages(imageUrls) {
  if (!isSupabaseConfigured) return;
  await removeUnusedProductImages(imageUrls);
}
