import { isSupabaseConfigured, supabaseRequest } from "../../../lib/supabase";
import { createLocalBooking, readLocalBookings, updateLocalBooking } from "../../../lib/lightweightStore";

export function getAppointmentErrorMessage(error, fallback) {
  if (["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."].includes(error?.message)) {
    return "Network request failed. Check your internet connection and try again.";
  }
  return error?.message || fallback;
}

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

function fromAppointmentRow(row) {
  return {
    id: row.id,
    reference: row.booking_reference,
    customer: {
      name: row.customer_name,
      whatsapp: row.whatsapp,
      email: row.email,
    },
    services: (row.services || []).map((service) => ({
      productId: service.product_id,
      title: service.title,
      price: Number(service.price),
      duration: Number(service.duration_minutes),
    })),
    total: Number(row.total_price),
    duration: Number(row.duration_minutes),
    appointmentAt: row.appointment_at,
    notes: row.notes || "",
    deposit: Number(row.deposit_amount),
    depositStatus: row.deposit_status,
    bookingStatus: row.booking_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromPublicAppointment(row) {
  return {
    reference: row.reference,
    customerName: row.customer_name,
    services: (row.services || []).map((service) => ({
      productId: service.product_id,
      title: service.title,
      price: Number(service.price),
      duration: Number(service.duration_minutes),
    })),
    total: Number(row.total_price),
    duration: Number(row.duration_minutes),
    appointmentAt: row.appointment_at,
    deposit: Number(row.deposit_amount),
    depositStatus: row.deposit_status,
    bookingStatus: row.booking_status,
    createdAt: row.created_at,
  };
}

export async function createAppointment(appointment) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Appointment requests cannot be saved in preview mode.");
  }
  const productIds = appointment.products.map((product) => product.productId ?? product.id);
  if (productIds.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new Error("The selected services are invalid. Refresh and select them again.");
  }
  const row = await supabaseRequest("rpc/create_hadad_appointment", "", {
    method: "POST",
    body: {
      p_customer_name: appointment.customer.name,
      p_whatsapp: appointment.customer.whatsapp,
      p_email: appointment.customer.email,
      p_product_ids: productIds,
      p_notes: appointment.notes,
      p_idempotency_key: appointment.idempotencyKey,
      p_confirmation_token: appointment.confirmationToken,
    },
  });
  if (!row?.reference || !Array.isArray(row.services)) {
    throw new Error("Supabase did not confirm that the appointment was saved. Please retry the request.");
  }
  return fromPublicAppointment(row);
}

export async function getAppointmentConfirmation(reference, confirmationToken) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. This appointment cannot be verified.");
  }
  const row = await supabaseRequest("rpc/get_hadad_appointment_confirmation", "", {
    method: "POST",
    body: {
      p_reference: reference,
      p_confirmation_token: confirmationToken,
    },
  });
  if (!row?.reference) return null;
  return fromPublicAppointment(row);
}

export async function getAppointments() {
  if (!isSupabaseConfigured) return [];
  const rows = await supabaseRequest(
    "appointments",
    `select=${encodeURIComponent("id,booking_reference,customer_name,whatsapp,email,service_ids,services,total_price,duration_minutes,appointment_at,notes,deposit_amount,deposit_status,booking_status,created_at,updated_at")}&order=${encodeURIComponent("created_at.desc")}`
  );
  return (rows || []).map(fromAppointmentRow);
}

export async function updateAppointment(id, changes) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const result = await supabaseRequest("rpc/update_hadad_appointment", "", {
    method: "POST",
    body: {
      p_appointment_id: id,
      p_booking_status: changes.bookingStatus ?? null,
      p_deposit_status: changes.depositStatus ?? null,
    },
  });
  if (!result?.id) throw new Error("Appointment was not found or the change could not be saved.");
  return fromAppointmentRow(result);
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
