const arabicNumber = new Intl.NumberFormat("ar-EG-u-nu-arab", { maximumFractionDigits: 0 });

function formatArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => arabicNumber.format(Number(digit)));
}

function formatArabicPrice(value) {
  return arabicNumber.format(Number(value) || 0);
}

export function buildWhatsAppBookingMessage({ name, phone, preferredDateTime, services, total, notes = "" }) {
  const appointment = new Date(preferredDateTime);
  const date = new Intl.DateTimeFormat("ar-EG-u-ca-gregory-nu-arab", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(appointment);
  const hour = appointment.getHours() % 12 || 12;
  const time = `${formatArabicDigits(hour)}:${formatArabicDigits(String(appointment.getMinutes()).padStart(2, "0"))} ${appointment.getHours() < 12 ? "صباحًا" : "مساءً"}`;

  return [
    "السلام عليكم كنت عايز أحجز معاد.",
    "",
    `الاسم: ${name.trim()}`,
    "",
    `رقم الموبايل: ${phone.trim()}`,
    "",
    `اليوم: ${date}`,
    "",
    `الساعة: ${time}`,
    "",
    "عايز أعمل:",
    "",
    ...services.map((service) => `- ${service.title} — ${formatArabicPrice(service.price)} جنيه`),
    `الحساب كله: ${formatArabicPrice(total)} جنيه`,
    "",
    "ياريت تقولولي المعاد ده متاح ولا لأ، وشكرًا ليكم.",
    ...(notes.trim() ? ["", `ملاحظات: ${notes.trim()}`] : []),
  ].join("\n");
}

export function buildWhatsAppBookingUrl(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
