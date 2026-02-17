// Timer (SRP): schedules warnings for tasks (5-min before end, 1-min before next task, 5-min break check)
// Background notifications use Notification API / Service Worker via audio.js helpers.

import { addMinutes } from "./utils.js";
import { getTasks } from "./storage.js";
import { say, chime, notify, requestPermissions } from "./audio.js";

let scheduled = [];
let initialized = false;

function clearScheduled() {
  scheduled.forEach((id) => clearTimeout(id));
  scheduled = [];
}

function sortByStart(tasks) {
  return [...tasks].sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
}

/** Build all task instances (including recurring) within a time range */
function buildInstances(startMs, endMs) {
  const tasks = getTasks();
  const instances = [];

  // Base tasks overlapping window
  for (const t of tasks) {
    const s = new Date(t.startISO).getTime();
    const e = s + t.durationMin * 60_000;
    if (e > startMs && s < endMs) {
      instances.push({ task: t, startMs: s, endMs: e });
    }
  }

  // Recurring tasks: instantiate on matching weekdays from max(t.startDate, windowStart) to windowEnd
  const startDay = new Date(startMs);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endMs);
  endDay.setHours(0, 0, 0, 0);

  for (const t of tasks) {
    if (!Array.isArray(t.recurrenceDays) || t.recurrenceDays.length === 0) continue;
    const baseStart = new Date(t.startISO);
    const baseStartDay = new Date(baseStart);
    baseStartDay.setHours(0, 0, 0, 0);

    // Iterate days
    for (
      let d = new Date(Math.max(startDay.getTime(), baseStartDay.getTime()));
      d.getTime() <= endDay.getTime();
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
      const weekday = d.getDay();
      if (!t.recurrenceDays.includes(weekday)) continue;
      const instStart = new Date(d);
      instStart.setHours(baseStart.getHours(), baseStart.getMinutes(), 0, 0);
      const sMs = instStart.getTime();
      const eMs = sMs + t.durationMin * 60_000;
      if (eMs > startMs && sMs < endMs) {
        instances.push({ task: t, startMs: sMs, endMs: eMs });
      }
    }
  }

  return sortByStart(instances);
}

function getActiveTask(nowMs) {
  const instances = buildInstances(nowMs - 24 * 60_000, nowMs + 24 * 60_000);
  for (const inst of instances) {
    if (nowMs >= inst.startMs && nowMs < inst.endMs) return inst;
  }
  return null;
}

function getNextTask(nowMs) {
  const instances = buildInstances(nowMs, nowMs + 7 * 24 * 60_000);
  for (const inst of instances) {
    if (inst.startMs > nowMs) return inst;
  }
  return null;
}

function getPrevTask(beforeMs) {
  const instances = buildInstances(beforeMs - 7 * 24 * 60_000, beforeMs);
  let prev = null;
  for (const inst of instances) {
    if (inst.startMs < beforeMs) prev = inst;
    else break;
  }
  return prev;
}

function scheduleAt(whenMs, fn) {
  const now = Date.now();
  const delay = Math.max(0, whenMs - now);
  const id = setTimeout(fn, delay);
  scheduled.push(id);
}

function scheduleWarnings() {
  clearScheduled();

  const nowMs = Date.now();

  // Active task: 5-minute warning before it ends
  const active = getActiveTask(nowMs);
  if (active) {
    const warnAt = active.endMs - 5 * 60_000; // 5 min before end
    if (warnAt > nowMs) {
      scheduleAt(warnAt, () => {
        const title = "Task ending soon";
        const body = `${active.task.title} ends in 5 minutes.`;
        chime();
        say(body);
        notify(title, body);
      });
    }
  }

  // Next task: 5-minute warning before it starts
  const next = getNextTask(nowMs);
  if (next) {
    const fiveMinWarnAt = next.startMs - 5 * 60_000;
    if (fiveMinWarnAt > nowMs) {
      scheduleAt(fiveMinWarnAt, () => {
        const startText = new Date(next.startMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const title = "Upcoming task";
        const body = `${next.task.title} starts in 5 minutes (${startText}).`;
        chime();
        say(body);
        notify(title, body);
      });
    }

    // Mandatory break check (warn-only): ensure at least 5 minutes between previous end and next start
    const prev = getPrevTask(next.startMs);
    if (prev) {
      const gapMs = next.startMs - (prev.startMs + prev.task.durationMin * 60_000);
      if (gapMs < 5 * 60_000) {
        // Warn at previous task end time if in the future, else warn immediately
        const warnBreakAt = prev.startMs + prev.task.durationMin * 60_000;
        if (warnBreakAt > nowMs) {
          scheduleAt(warnBreakAt, () => {
            const title = "Short break detected";
            const body = "Less than 5 minutes between tasks. Consider a short pause.";
            chime();
            say(body);
            notify(title, body);
          });
        } else {
          // Immediate warn (already within short gap)
          const title = "Short break detected";
          const body = "Less than 5 minutes between tasks. Consider a short pause.";
          chime();
          say(body);
          notify(title, body);
        }
      }
    }
  }

  // Safety reschedule: re-evaluate every minute to catch changes
  scheduled.push(setTimeout(scheduleWarnings, 60_000));
}

export async function initTimer() {
  if (initialized) return;
  initialized = true;
  await requestPermissions();
  scheduleWarnings();
}

export function rescheduleTimer() {
  // Call when tasks are added/updated/deleted
  scheduleWarnings();
}