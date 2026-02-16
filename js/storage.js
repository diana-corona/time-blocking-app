// Storage (SRP): local-only persistence for tasks and settings
 // Schema:
 // Task = {
 //   id: string,
 //   title: string,
 //   color?: string,
 //   startISO: string (YYYY-MM-DDTHH:mm:ss.sssZ),
 //   durationMin: number,
 //   recurrenceDays?: number[] // 0..6 (Sun..Sat)
 //   exceptionDates?: string[] // ["YYYY-MM-DD", ...] dates where recurrence is skipped
 // }
const TASKS_KEY = "tb_tasks";
const SETTINGS_KEY = "tb_settings";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSettings() {
  return readJSON(SETTINGS_KEY, {
    silent: false,
    defaultDurationMin: 30,
    timeFormat: "12h",
  });
}

export function setSettings(next) {
  writeJSON(SETTINGS_KEY, next);
}

export function getTasks() {
  const tasks = readJSON(TASKS_KEY, []);
  // basic validation
  return tasks.filter(
    (t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.title === "string" &&
      typeof t.startISO === "string" &&
      typeof t.durationMin === "number"
  );
}

export function saveTasks(tasks) {
  writeJSON(TASKS_KEY, tasks);
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function addTask(task) {
  const tasks = getTasks();
  const recurrenceDays = Array.isArray(task.recurrenceDays)
    ? task.recurrenceDays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
    : undefined;

  const t = {
    id: genId(),
    title: task.title.trim(),
    color: task.color || "#0ea5e9",
    startISO: task.startISO, // ISO string
    durationMin: Number(task.durationMin) || 30,
    recurrenceDays,
    exceptionDates: Array.isArray(task.exceptionDates) ? [...task.exceptionDates] : [],
  };
  tasks.push(t);
  saveTasks(tasks);
  return t;
}

export function updateTask(patch) {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === patch.id);
  if (idx === -1) return null;

  const existing = tasks[idx];

  const recurrenceDays = Array.isArray(patch.recurrenceDays)
    ? patch.recurrenceDays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
    : existing.recurrenceDays;

  const updated = {
    ...existing,
    title:
      typeof patch.title === "string"
        ? patch.title.trim()
        : existing.title,
    color: patch.color || existing.color,
    startISO: typeof patch.startISO === "string" ? patch.startISO : existing.startISO,
    durationMin:
      typeof patch.durationMin === "number"
        ? (Number(patch.durationMin) || existing.durationMin)
        : existing.durationMin,
    recurrenceDays,
    exceptionDates: Array.isArray(patch.exceptionDates)
      ? patch.exceptionDates
      : existing.exceptionDates || [],
  };

  tasks[idx] = updated;
  saveTasks(tasks);
  return updated;
}

export function deleteTask(id) {
  const tasks = getTasks();
  const next = tasks.filter((t) => t.id !== id);
  saveTasks(next);
}

export function tasksInRange(startDate, endDate) {
  // startDate, endDate: Date objects
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  return getTasks().filter((t) => {
    const s = new Date(t.startISO).getTime();
    const e = s + t.durationMin * 60 * 1000;
    // overlap check
    return e > startMs && s < endMs;
  });
}

export function tasksOnDay(dayDate) {
  const day = new Date(dayDate);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);
  const dayKey = day.toISOString().slice(0, 10); // YYYY-MM-DD

  // Base tasks directly scheduled on this day, respecting exceptionDates on recurring tasks
  const base = tasksInRange(day, dayEnd).filter((t) => {
    if (!Array.isArray(t.exceptionDates)) return true;
    return !t.exceptionDates.includes(dayKey);
  });

  // Expand recurring tasks occurring on this weekday (from start date onward),
  // skipping any days explicitly listed in exceptionDates.
  const weekday = day.getDay();
  const recurrences = getTasks()
    .filter((t) => Array.isArray(t.recurrenceDays) && t.recurrenceDays.includes(weekday))
    .filter((t) => {
      // Only include if recurrence start date is <= this day
      const startDate = new Date(t.startISO);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() <= day.getTime();
    })
    .filter((t) => {
      if (!Array.isArray(t.exceptionDates)) return true;
      return !t.exceptionDates.includes(dayKey);
    })
    .map((t) => {
      const original = new Date(t.startISO);
      const inst = new Date(day);
      inst.setHours(original.getHours(), original.getMinutes(), 0, 0);
      return {
        ...t,
        // keep same id to edit base task
        startISO: inst.toISOString(),
      };
    });

  // Merge and sort by start time
  const merged = [...base, ...recurrences].sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );

  return merged;
}
