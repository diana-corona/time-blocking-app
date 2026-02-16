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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const state = {
  currentView: "week", // 'week' | 'month'
  currentDateISO: todayISO(),
  silent: false,
};

function qs(id) {
  return document.getElementById(id);
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

  // Accessibility hint for today highlight
  weekViewEl.setAttribute("aria-describedby", "today");
  monthViewEl.setAttribute("aria-describedby", "today");
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
    const nextDate = addDays(base, dir * 7);
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

// Render Week View with 7 columns and hourly gridlines
function renderWeek(baseDate) {
  const container = qs("weekView");
  container.innerHTML = "";

  const days = getWeekDays(baseDate, 0);
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
    for (let hour = 0; hour < 24; hour++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      const tm = new Date(d);
      tm.setHours(hour, 0, 0, 0);
      line.dataset.time = tm.toISOString();
      const label = document.createElement("span");
      label.className = "hour-label";
      label.textContent = format12h(tm);
      line.appendChild(label);
      hourGrid.appendChild(line);
    }
    col.appendChild(hourGrid);

    // Placeholder tasks container (to be populated by tasks module later)
    const tasksLayer = document.createElement("div");
    tasksLayer.className = "tasks-layer";
    col.appendChild(tasksLayer);

    gridRow.appendChild(col);
  });
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
function openTaskModal() {
  const modal = qs("taskModal");
  const form = qs("taskForm");
  const deleteBtn = qs("deleteTaskBtn");
  const closeBtn = qs("closeModalBtn");

  // Defaults for new task
  qs("taskId").value = "";
  qs("taskTitle").value = "";
  qs("taskStartDate").value = state.currentDateISO;
  qs("taskStartTime").value = "09:00";
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
});
