// Main App Controller (initial scaffolding) - SRP: boot, UI wiring, view switching, basic rendering
import {
  toISODate,
  fromISODate,
  addDays,
  getWeekDays,
  todayISO,
  getMonthMatrix,
  format12h,
} from "./utils.js";
import { renderWeekTasks, renderMonthDots, wireNewTaskModalHandlers, saveNewTaskFromModal, initTaskControlsDelegation } from "./tasks.js";
import { initTimer } from "./timer.js";
import { initTaskProgressView } from "./task-progress.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRODUCTIVE_START_HOUR = 5;
const PRODUCTIVE_END_HOUR = 23;

const state = {
  currentView: "week", // 'week' | 'month'
  currentDateISO: todayISO(),
  silent: false,
};

let nowLineIntervalId = null;

function qs(id) {
  return document.getElementById(id);
}

function isMobileDayView() {
  try {
    if (window.matchMedia) {
      return window.matchMedia("(max-width: 480px)").matches;
    }
  } catch {
    // ignore
  }
  return window.innerWidth <= 480;
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  }
}

function initUI() {
  const weekViewBtn = qs("weekViewBtn");
  const monthViewBtn = qs("monthViewBtn");
  const weekViewEl = qs("weekView");
  const monthViewEl = qs("monthView");
  const datePicker = qs("datePicker");
  const prevBtn = qs("prevBtn");
  const nextBtn = qs("nextBtn");
  const todayBtn = qs("todayBtn");
  const silentToggle = qs("silentToggle");
  const newTaskBtn = qs("newTaskBtn");

  // Date picker default to today
  datePicker.value = state.currentDateISO;

  // View buttons
  weekViewBtn.addEventListener("click", () => setView("week"));
  monthViewBtn.addEventListener("click", () => setView("month"));

  // Navigation
  prevBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", () => navigate(1));
  todayBtn.addEventListener("click", goToToday);
  datePicker.addEventListener("change", (e) => {
    state.currentDateISO = e.target.value || todayISO();
    render();
  });

  // Silent toggle persisted in localStorage (Android/private-mode safe)
  let savedSilent = false;
  try {
    savedSilent = localStorage.getItem("silent") === "true";
  } catch (e) {
    console.warn("TimeBlocking: unable to read silent flag from localStorage, defaulting to false", e);
  }
  state.silent = savedSilent;
  silentToggle.checked = savedSilent;
  silentToggle.addEventListener("change", (e) => {
    state.silent = !!e.target.checked;
    try {
      localStorage.setItem("silent", String(state.silent));
    } catch (err) {
      console.warn("TimeBlocking: unable to persist silent flag to localStorage", err);
    }
  });

  // Modal open
  newTaskBtn.addEventListener("click", openTaskModal);

  // Render initial view
  updateViewButtons();
  render();

  // Re-render on resize/orientation changes so mobile daily vs week view stays in sync
  window.addEventListener("resize", () => {
    if (state.currentView === "week") {
      render();
    }
  });

  // Accessibility hint for today highlight
  weekViewEl.setAttribute("aria-describedby", "today");
  monthViewEl.setAttribute("aria-describedby", "today");

  startNowLineTimer();
}

function setView(view) {
  state.currentView = view;
  updateViewButtons();
  render();
}

function updateViewButtons() {
  const weekViewBtn = qs("weekViewBtn");
  const monthViewBtn = qs("monthViewBtn");
  const weekViewEl = qs("weekView");
  const monthViewEl = qs("monthView");

  const isWeek = state.currentView === "week";
  weekViewBtn.classList.toggle("active", isWeek);
  weekViewBtn.setAttribute("aria-selected", String(isWeek));
  monthViewBtn.classList.toggle("active", !isWeek);
  monthViewBtn.setAttribute("aria-selected", String(!isWeek));

  weekViewEl.classList.toggle("hidden", !isWeek);
  monthViewEl.classList.toggle("hidden", isWeek);
}

function navigate(dir) {
  // dir: -1 or 1
  const base = fromISODate(state.currentDateISO);
  if (state.currentView === "week") {
    // On narrow mobile screens, move by 1 day; otherwise, move by full week
    const step = isMobileDayView() ? 1 : 7;
    const nextDate = addDays(base, dir * step);
    state.currentDateISO = toISODate(nextDate);
  } else {
    const nextMonth = new Date(base);
    nextMonth.setMonth(nextMonth.getMonth() + dir);
    state.currentDateISO = toISODate(nextMonth);
  }
  qs("datePicker").value = state.currentDateISO;
  render();
}

function goToToday() {
  state.currentDateISO = todayISO();
  qs("datePicker").value = state.currentDateISO;
  render();
}

function render() {
  const baseDate = fromISODate(state.currentDateISO);
  if (state.currentView === "week") {
    renderWeek(baseDate);
    renderWeekTasks(baseDate);
  } else {
    renderMonth(baseDate);
    renderMonthDots(baseDate);
  }
}

function getPxPerMinute() {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue("--hour-line-height")
    .trim();
  const pxPerHour = Number.parseFloat(val || "52");
  return pxPerHour / 60;
}

function minutesFromMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function updateNowLines() {
  const container = qs("weekView");
  if (!container) return;

  const todayIso = todayISO();
  const now = new Date();
  const totalMinutes = minutesFromMidnight(now);
  const startMin = PRODUCTIVE_START_HOUR * 60;
  const endMin = PRODUCTIVE_END_HOUR * 60;
  const pxPerMin = getPxPerMinute();
  const minutesFromStart = totalMinutes - startMin;
  const topPx = minutesFromStart * pxPerMin;

  const columns = container.querySelectorAll(".day-column");
  columns.forEach((col) => {
    const dateISO = col.dataset.date;
    let line = col.querySelector(".now-line");

    const outsideProductive =
      totalMinutes < startMin || totalMinutes >= endMin;

    if (dateISO !== todayIso || state.currentView !== "week" || outsideProductive) {
      if (line) {
        line.remove();
      }
      return;
    }

    if (!line) {
      line = document.createElement("div");
      line.className = "now-line";
      col.appendChild(line);
    }

    line.style.top = `${topPx}px`;
  });
}

function startNowLineTimer() {
  if (nowLineIntervalId !== null) {
    clearInterval(nowLineIntervalId);
  }

  const tick = () => {
    if (state.currentView === "week") {
      updateNowLines();
    }
  };

  tick();
  nowLineIntervalId = window.setInterval(tick, 60000);
}

// Render Week View with 7 columns and hourly gridlines
function renderWeek(baseDate) {
  const container = qs("weekView");
  container.innerHTML = "";

  // On mobile, render a single-day "daily" view; on larger screens, render full week
  const days = isMobileDayView() ? [baseDate] : getWeekDays(baseDate, 0);
  const today = new Date();

  const headerRow = document.createElement("div");
  headerRow.className = "week-header";
  container.appendChild(headerRow);

  const gridRow = document.createElement("div");
  gridRow.className = "week-grid";
  container.appendChild(gridRow);

  days.forEach((d) => {
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();

    // Header cell
    const h = document.createElement("div");
    h.className = "day-header" + (isToday ? " today" : "");
    h.textContent = `${DAY_NAMES[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
    headerRow.appendChild(h);

    // Day column with hourly lines
    const col = document.createElement("div");
    col.className = "day-column";
    col.dataset.date = toISODate(d);

    const hourGrid = document.createElement("div");
    hourGrid.className = "hour-grid";
    for (let hour = PRODUCTIVE_START_HOUR; hour < PRODUCTIVE_END_HOUR; hour++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      const tm = new Date(d);
      tm.setHours(hour, 0, 0, 0);
      line.dataset.time = tm.toISOString();
      const label = document.createElement("span");
      label.className = "hour-label";
      label.textContent = format12h(tm);
      line.appendChild(label);

      // Open new-task modal for this time slot (desktop: dblclick, mobile: single tap)
      const openForSlot = (e) => {
        e.preventDefault();
        const slot = line.dataset.time ? new Date(line.dataset.time) : new Date(d);
        openTaskModal(slot);
      };

      const hasTouch =
        ("ontouchstart" in window) ||
        (navigator && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0);

      if (hasTouch) {
        // Mobile/touch: single tap
        line.addEventListener("click", openForSlot);
      } else {
        // Desktop: double-click
        line.addEventListener("dblclick", openForSlot);
      }

      hourGrid.appendChild(line);
    }
    col.appendChild(hourGrid);

    // Placeholder tasks container (to be populated by tasks module later)
    const tasksLayer = document.createElement("div");
    tasksLayer.className = "tasks-layer";
    col.appendChild(tasksLayer);

    gridRow.appendChild(col);
  });

  updateNowLines();
}

// Render Month View with 6x7 grid
function renderMonth(baseDate) {
  const container = qs("monthView");
  container.innerHTML = "";

  const matrix = getMonthMatrix(baseDate);
  const today = new Date();

  const monthHeader = document.createElement("div");
  monthHeader.className = "month-header";
  DAY_NAMES.forEach((dn) => {
    const hd = document.createElement("div");
    hd.className = "month-dayname";
    hd.textContent = dn;
    monthHeader.appendChild(hd);
  });
  container.appendChild(monthHeader);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";
  container.appendChild(monthGrid);

  matrix.forEach((week) => {
    week.forEach((d) => {
      const cell = document.createElement("div");
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      const isOtherMonth = d.getMonth() !== baseDate.getMonth();

      cell.className = "month-cell" + (isToday ? " today" : "") + (isOtherMonth ? " other" : "");
      const dayNum = document.createElement("div");
      dayNum.className = "day-num";
      dayNum.textContent = String(d.getDate());
      cell.appendChild(dayNum);

      // Placeholder tasks dot/layer
      const dots = document.createElement("div");
      dots.className = "task-dots";
      cell.appendChild(dots);

      monthGrid.appendChild(cell);
    });
  });
}

 // Modal handlers (basic scaffolding)
function openTaskModal(initialDate) {
  const modal = qs("taskModal");
  const form = qs("taskForm");
  const deleteBtn = qs("deleteTaskBtn");
  const closeBtn = qs("closeModalBtn");

  // Determine initial date/time for new task
  let base;
  if (initialDate instanceof Date && !Number.isNaN(initialDate.getTime())) {
    base = new Date(initialDate);
  } else {
    base = fromISODate(state.currentDateISO);
    base.setHours(9, 0, 0, 0);
  }

  // Defaults for new task
  qs("taskId").value = "";
  qs("taskTitle").value = "";
  qs("taskStartDate").value = toISODate(base);
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  qs("taskStartTime").value = `${hh}:${mm}`;
  qs("taskDuration").value = 30;
  qs("taskColor").value = "#0ea5e9";

  modal.classList.remove("hidden");

  // Delegate modal handlers to tasks module (adds submit/close listeners and re-renders)
  wireNewTaskModalHandlers();
}

document.addEventListener("DOMContentLoaded", () => {
  registerSW();
  initUI();
  initTaskControlsDelegation();
  initTimer();
  initTaskProgressView();
});
