import { isSupabaseConfigured, supabaseRequest } from "../../../lib/supabase";
import { createLocalBooking, readLocalBookings, updateLocalBooking } from "../../../lib/lightweightStore";

function fromBookingRow(row) {
  return {
    id: row.id,
    customer: { name: row.customer_name, whatsapp: row.whatsapp, email: row.email },
    products: (row.products || []).map((product) => ({
      productId: product.product_id,
      title: product.title,
      price: product.price,
    })),
    total: row.total,
    deposit: row.deposit,
    remaining: row.remaining,
    paymentStatus: row.payment_status,
    bookingStatus: row.booking_status,
    createdAt: row.created_at,
  };
}

export async function createBooking(booking) {
  if (!isSupabaseConfigured) {
    const created = createLocalBooking(booking);
    return created;
  }

  const productIds = booking.products.map((product) => product.productId ?? product.id);
  if (productIds.some((id) => typeof id !== "string" || !id)) {
    throw new Error("The selected services are invalid. Please refresh and select them again.");
  }
  await supabaseRequest("rpc/create_hadad_booking", "", {
    method: "POST",
    body: {
      p_customer_name: booking.customer.name,
      p_whatsapp: booking.customer.whatsapp,
      p_email: booking.customer.email,
      p_product_ids: productIds,
    },
  });
}

export async function getBookings() {
  if (!isSupabaseConfigured) {
    return readLocalBookings().map((booking) => ({
      ...booking,
      products: Array.isArray(booking.products) ? booking.products.map((product) => ({
        productId: product.productId ?? product.id,
        title: product.title,
        price: Number(product.price),
      })) : [],
      paymentStatus: booking.paymentStatus || "pending",
      bookingStatus: booking.bookingStatus || "pending",
      createdAt: booking.createdAt || new Date().toISOString(),
    }));
  }

  const rows = await supabaseRequest("bookings", "select=*&order=created_at.desc");
  return (rows || []).map(fromBookingRow);
}

export async function updateBooking(id, field, value) {
  if (!isSupabaseConfigured) {
    const allowedValues = field === "paymentStatus"
      ? ["pending", "confirmed", "rejected"]
      : field === "bookingStatus"
        ? ["pending", "confirmed", "completed", "cancelled"]
        : [];
    if (!allowedValues.includes(value)) throw new Error("Invalid request status.");
    updateLocalBooking(id, field, value);
    return;
  }

  const allowedValues = field === "paymentStatus"
    ? ["pending", "confirmed", "rejected"]
    : field === "bookingStatus"
      ? ["pending", "confirmed", "completed", "cancelled"]
      : [];
  if (!allowedValues.includes(value)) throw new Error("Invalid request status.");

  const column = field === "paymentStatus" ? "payment_status" : "booking_status";
  const rows = await supabaseRequest("bookings", `id=eq.${encodeURIComponent(id)}&select=id`, {
    method: "PATCH",
    body: { [column]: value },
  });
  if (!rows?.length) throw new Error("Booking was not found or the database rejected the change.");
}
