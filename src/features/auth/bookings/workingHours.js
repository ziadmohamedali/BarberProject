export const DEFAULT_WORKING_HOURS = {
  openingTime: "12:00",
  closingTime: "01:00",
};

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseTime = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export function toLocalDateTimeValue(date) {
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function getAvailableTimeSlots(dateKey, openingTime, closingTime, now = new Date(), maximum = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    || selectedDate.getFullYear() !== year
    || selectedDate.getMonth() !== month - 1
    || selectedDate.getDate() !== day
  ) return [];

  const openingMinutes = parseTime(openingTime);
  const closingMinutes = parseTime(closingTime);
  if (openingMinutes === null || closingMinutes === null) return [];

  const crossesMidnight = closingMinutes <= openingMinutes;
  const slots = new Map();
  for (const startDayOffset of [-1, 0]) {
    const shiftDate = new Date(year, month - 1, day + startDayOffset);
    const shiftStart = new Date(
      shiftDate.getFullYear(),
      shiftDate.getMonth(),
      shiftDate.getDate(),
      Math.floor(openingMinutes / 60),
      openingMinutes % 60
    );
    const shiftEnd = new Date(
      shiftDate.getFullYear(),
      shiftDate.getMonth(),
      shiftDate.getDate() + (crossesMidnight ? 1 : 0),
      Math.floor(closingMinutes / 60),
      closingMinutes % 60
    );

    for (let slot = shiftStart; slot < shiftEnd; slot = new Date(slot.getTime() + 30 * 60 * 1000)) {
      if (localDateKey(slot) !== dateKey || slot < now || slot > maximum) continue;
      slots.set(slot.getTime(), new Date(slot));
    }
  }
  return [...slots.values()].sort((left, right) => left - right);
}
