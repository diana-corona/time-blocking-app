// Utils: date/time helpers, formatting, calculations (SRP)
export const MINUTES = 60 * 1000;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(d, weekStartsOn = 0) {
  // weekStartsOn: 0 Sunday, 1 Monday
  const date = new Date(d);
  const day = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function addMinutes(d, n) {
  const date = new Date(d);
  date.setTime(date.getTime() + n * MINUTES);
  return date;
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function format12h(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function parseTimeToDate(dateISO, timeStr) {
  // timeStr: "HH:MM"
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = fromISODate(dateISO);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MINUTES);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function getWeekDays(baseDate, weekStartsOn = 0) {
  const start = startOfWeek(baseDate, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function todayISO() {
  return toISODate(new Date());
}

export function now() {
  return new Date();
}

export function getMonthMatrix(d) {
  // Returns array of weeks, each week is array of Date objects covering full month grid
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(firstOfMonth, 0);
  const weeks = [];
  let cursor = new Date(start);
  // Up to 6 weeks in a month grid
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    // Stop if we've passed the last day and ended on a Sunday
    if (weeks.length >= 4) {
      const last = weeks[weeks.length - 1][6];
      if (last.getMonth() !== d.getMonth() && last.getDay() === 0) break;
    }
  }
  return weeks;
}