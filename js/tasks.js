// Tasks (SRP): render tasks in calendar, edit modal integration, drag-and-drop movement
import {
  toISODate,
  fromISODate,
  addMinutes,
  format12h,
} from "./utils.js";
import {
  getTasks,
  tasksOnDay,
  updateTask,
  deleteTask,
  addTask,
  getSettings,
} from "./storage.js";
import { rescheduleTimer } from "./timer.js";

function qs(id) {
  return document.getElementById(id);
}

function readDurationMinutesFromInputs() {
  const inputEl = qs("taskDuration");
  if (!inputEl) return NaN;
  const raw = Number(inputEl.value);
  const unitEl = qs("taskDurationUnit");
  const unit = unitEl ? unitEl.value : "minutes";

  if (!Number.isFinite(raw) || raw <= 0) return NaN;
  return unit === "hours" ? raw * 60 : raw;
}

function setDurationInputsFromMinutes(totalMinutes) {
  const inputEl = qs("taskDuration");
  const unitEl = qs("taskDurationUnit");
  if (!inputEl || !unitEl) return;

  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    inputEl.value = totalMinutes / 60;
    unitEl.value = "hours";
  } else {
    inputEl.value = totalMinutes;
    unitEl.value = "minutes";
  }
}

export function initTaskControlsDelegation() {
  // Delegate clicks for dynamically rendered task controls to ensure edit/delete work
  document.addEventListener("click", (e) => {
    const editEl = e.target.closest(".task-edit-btn");
    const delEl = e.target.closest(".task-delete-btn");
    if (!editEl && !delEl) return;

    const block = (editEl || delEl).closest(".task-block");
    if (!block) return;
    const id = block.dataset.id;

    const tasks = getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (editEl) {
      e.preventDefault();
      openEditModal(task);
      return;
    }

    if (delEl) {
      e.preventDefault();
      deleteTask(id);
      const baseDateISO = qs("datePicker").value;
      const baseDate = fromISODate(baseDateISO);
      renderWeekTasks(baseDate);
      renderMonthDots(baseDate);
      rescheduleTimer();
    }
  });
}

function getPxPerMinute() {
  const val = getComputedStyle(document.documentElement).getPropertyValue("--hour-line-height").trim();
  const pxPerHour = Number.parseFloat(val || "52");
  return pxPerHour / 60;
}

function getDayColumnHeightPx() {
  const val = getComputedStyle(document.documentElement).getPropertyValue("--hour-line-height").trim();
  const pxPerHour = Number.parseFloat(val || "52");
  return pxPerHour * 24;
}

function minutesFromMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function endTime(startDate, durationMin) {
  return addMinutes(startDate, durationMin);
}

function taskTimeLabel(startDate, durationMin) {
  const end = endTime(startDate, durationMin);
  return `${format12h(startDate)} - ${format12h(end)}`;
}

function createTaskBlock(task, dayColumnEl, pxPerMin) {
  const start = new Date(task.startISO);
  const top = minutesFromMidnight(start) * pxPerMin;
  const height = Math.max(24, task.durationMin * pxPerMin); // min height for touch
  const block = document.createElement("div");
  block.className = "task-block";
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.style.background = task.color || "var(--color-accent)";
  block.dataset.id = task.id;

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const time = document.createElement("div");
  time.className = "task-time";
  time.textContent = taskTimeLabel(start, task.durationMin);

  block.appendChild(title);
  block.appendChild(time);

  // Enable drag within calendar column
  enableDrag(block, dayColumnEl, task, pxPerMin);

  // Open details on double-click in calendar view
  block.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    openEditModal(task);
  });

  return block;
}

export function renderWeekTasks(baseDate) {
  const pxPerMin = getPxPerMinute();
  const container = qs("weekView");
  if (!container) return;
  const columns = container.querySelectorAll(".day-column");
  columns.forEach((col) => {
    const dateISO = col.dataset.date;
    const day = fromISODate(dateISO);
    const tasksLayer = col.querySelector(".tasks-layer");
    if (!tasksLayer) return;
    tasksLayer.innerHTML = "";
    const tasks = tasksOnDay(day);
    tasks.forEach((t) => {
      const block = createTaskBlock(t, col, pxPerMin);
      tasksLayer.appendChild(block);
    });
  });
}

export function renderMonthDots(baseDate) {
  const container = qs("monthView");
  if (!container) return;
  const cells = container.querySelectorAll(".month-grid .month-cell");
  // Map cells to date by reading the day number relative to the month we are displaying.
  // For simplicity, recompute based on DOM: day number text + current displayed month context.
  const baseMonth = baseDate.getMonth();
  const baseYear = baseDate.getFullYear();
  cells.forEach((cell) => {
    const dayNumEl = cell.querySelector(".day-num");
    const dotsEl = cell.querySelector(".task-dots");
    if (!dayNumEl || !dotsEl) return;
    dotsEl.innerHTML = "";
    const dayNum = Number(dayNumEl.textContent);
    // Derive displayed month from class .other
    const isOther = cell.classList.contains("other");
    const d = new Date(baseYear, baseMonth + (isOther ? (dayNum < 15 ? 1 : -1) : 0), dayNum);
    const num = tasksOnDay(d).length;
    if (num > 0) {
      // Render up to 3 dots by CSS ::before, additional count label
      const count = document.createElement("span");
      count.style.marginLeft = "28px";
      count.style.fontSize = "12px";
      count.style.color = "var(--color-muted)";
      count.textContent = num > 3 ? `+${num - 3}` : "";
      dotsEl.appendChild(count);
    }
  });
}

function openEditModal(task) {
  const modal = qs("taskModal");

  // Reset form listeners by cloning/replacing the form node
  let form = qs("taskForm");
  const formParent = form.parentNode;
  const formClone = form.cloneNode(true);
  formParent.replaceChild(formClone, form);
  form = formClone;

  const deleteBtn = qs("deleteTaskBtn");
  const closeBtn = qs("closeModalBtn");

  qs("taskId").value = task.id;
  qs("taskTitle").value = task.title;
  const start = new Date(task.startISO);
  qs("taskStartDate").value = toISODate(start);
  const hh = String(start.getHours()).padStart(2, "0");
  const mm = String(start.getMinutes()).padStart(2, "0");
  qs("taskStartTime").value = `${hh}:${mm}`;
  setDurationInputsFromMinutes(task.durationMin);
  qs("taskColor").value = task.color || "#0ea5e9";

  // Populate recurrence checkboxes
  const recBoxes = document.querySelectorAll(".recurrence-day");
  recBoxes.forEach((cb) => {
    const day = Number(cb.dataset.day);
    cb.checked = Array.isArray(task.recurrenceDays) ? task.recurrenceDays.includes(day) : false;
  });

  modal.classList.remove("hidden");

  function close() {
    modal.classList.add("hidden");
    form.removeEventListener("submit", onSubmit);
    deleteBtn.removeEventListener("click", onDelete);
    closeBtn.removeEventListener("click", onClose);
  }
  function onSubmit(e) {
    e.preventDefault();
    const id = qs("taskId").value;
    const title = qs("taskTitle").value.trim();
    const dateISO = qs("taskStartDate").value;
    const timeStr = qs("taskStartTime").value;
    const [hhStr, mmStr] = timeStr.split(":");
    const d = fromISODate(dateISO);
    d.setHours(Number(hhStr), Number(mmStr), 0, 0);

    // Collect recurrence selection
    const recBoxes = document.querySelectorAll(".recurrence-day");
    const recurrenceDays = Array.from(recBoxes)
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.dataset.day));

    let durationMin = readDurationMinutesFromInputs();
    if (!Number.isFinite(durationMin)) {
      durationMin = getSettings().defaultDurationMin;
    }

    const updated = updateTask({
      id,
      title,
      color: qs("taskColor").value,
      startISO: d.toISOString(),
      durationMin,
      recurrenceDays,
    });
    close();
    // Re-render week and month
    const baseDateISO = qs("datePicker").value;
    const baseDate = fromISODate(baseDateISO);
    renderWeekTasks(baseDate);
    renderMonthDots(baseDate);
    rescheduleTimer();
  }
  function onDelete() {
    deleteTask(task.id);
    close();
    const baseDateISO = qs("datePicker").value;
    const baseDate = fromISODate(baseDateISO);
    renderWeekTasks(baseDate);
    renderMonthDots(baseDate);
    rescheduleTimer();
  }
  function onClose() {
    close();
  }

  form.addEventListener("submit", onSubmit);
  deleteBtn.addEventListener("click", onDelete);
  closeBtn.addEventListener("click", onClose);
}

// Add new task from modal (used by app controller)
export function saveNewTaskFromModal() {
  const title = qs("taskTitle").value.trim();
  const dateISO = qs("taskStartDate").value;
  const timeStr = qs("taskStartTime").value;
  const [hhStr, mmStr] = timeStr.split(":");
  const d = fromISODate(dateISO);
  d.setHours(Number(hhStr), Number(mmStr), 0, 0);
  let durationMin = readDurationMinutesFromInputs();
  if (!Number.isFinite(durationMin)) {
    durationMin = getSettings().defaultDurationMin;
  }

  // Collect recurrence selection
  const recBoxes = document.querySelectorAll(".recurrence-day");
  const recurrenceDays = Array.from(recBoxes)
    .filter((cb) => cb.checked)
    .map((cb) => Number(cb.dataset.day));

  const t = addTask({
    title,
    color: qs("taskColor").value,
    startISO: d.toISOString(),
    durationMin,
    recurrenceDays,
  });
  return t;
}

// Drag-and-drop
function enableDrag(block, dayColumnEl, task, pxPerMin) {
  const dayHeight = getDayColumnHeightPx();

  let dragging = false;
  let startY = 0;
  let startTop = 0;
  let moved = false;

  const onPointerDown = (ev) => {
    // Avoid starting drag when interacting with inline controls (Edit/Delete)
    if (ev.target.closest(".task-controls")) return;
    dragging = true;
    moved = false;
    block.classList.add("dragging");
    startY = ev.type.startsWith("touch") ? ev.touches[0].clientY : ev.clientY;
    startTop = parseFloat(block.style.top);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp, { passive: false });
    ev.preventDefault();
  };

  const onPointerMove = (ev) => {
    if (!dragging) return;
    const y = ev.type.startsWith("touch") ? ev.touches[0].clientY : ev.clientY;
    const dy = y - startY;
    if (Math.abs(dy) > 3) moved = true;
    let nextTop = startTop + dy;
    nextTop = Math.max(0, Math.min(nextTop, dayHeight - parseFloat(block.style.height)));
    block.style.top = `${nextTop}px`;

    // Allow cross-day drag: detect column under pointer
    const pointX = ev.type.startsWith("touch") ? ev.touches[0].clientX : ev.clientX;
    const pointY = y;
    const el = document.elementFromPoint(pointX, pointY);
    if (el) {
      const col = el.closest(".day-column");
      if (col && col !== dayColumnEl) {
        dayColumnEl = col; // switch current column reference
      }
    }
  };

  const onPointerUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);

    // If no movement, just reset; double-click opens details
    if (!moved) {
      block.classList.remove("dragging");
      return;
    }

    block.classList.remove("dragging");

    // Compute new start time from top
    const topPx = parseFloat(block.style.top);
    const minutes = Math.round(topPx / pxPerMin / 5) * 5; // snap to 5-min
    const dateISO = dayColumnEl.dataset.date;
    const base = fromISODate(dateISO);
    base.setHours(0, 0, 0, 0);
    const newStart = addMinutes(base, minutes);

    const isRecurring = Array.isArray(task.recurrenceDays) && task.recurrenceDays.length > 0;

    if (isRecurring) {
      const originalDate = new Date(task.startISO);
      originalDate.setHours(0, 0, 0, 0);

      const targetDate = new Date(base);
      targetDate.setHours(0, 0, 0, 0);

      const sameDay = originalDate.getTime() === targetDate.getTime();

      if (sameDay) {
        // Same-day move of a recurring instance:
        // 1) mark this date as an exception on the recurring task
        // 2) create a one-off task at the new time
        const dayKey = toISODate(originalDate); // YYYY-MM-DD
        const existingExceptions = Array.isArray(task.exceptionDates)
          ? [...task.exceptionDates]
          : [];
        if (!existingExceptions.includes(dayKey)) {
          existingExceptions.push(dayKey);
        }
        updateTask({
          id: task.id,
          exceptionDates: existingExceptions,
        });

        addTask({
          title: task.title,
          color: task.color,
          startISO: newStart.toISOString(),
          durationMin: task.durationMin,
          // no recurrenceDays => one-off instance
        });
      } else {
        // Cross-day drag of a recurring task => clone only, keep series untouched
        addTask({
          title: task.title,
          color: task.color,
          startISO: newStart.toISOString(),
          durationMin: task.durationMin,
          // no recurrenceDays => one-off instance
        });
      }
    } else {
      // Non-recurring tasks are truly moved
      updateTask({
        id: task.id,
        title: task.title,
        color: task.color,
        startISO: newStart.toISOString(),
        durationMin: task.durationMin,
      });
    }

    // Refresh week/month rendering
    const baseDateISO = qs("datePicker").value;
    const baseDate = fromISODate(baseDateISO);
    renderWeekTasks(baseDate);
    renderMonthDots(baseDate);
    rescheduleTimer();
  };

  block.addEventListener("pointerdown", onPointerDown, { passive: false });
  block.addEventListener("touchstart", onPointerDown, { passive: false });
}

export function wireNewTaskModalHandlers() {
  const modal = qs("taskModal");
  const form = qs("taskForm");
  const deleteBtn = qs("deleteTaskBtn");
  const closeBtn = qs("closeModalBtn");

  function close() {
    modal.classList.add("hidden");
    form.removeEventListener("submit", onSubmit);
    deleteBtn.removeEventListener("click", onDelete);
    closeBtn.removeEventListener("click", onClose);
  }
  function onSubmit(e) {
    e.preventDefault();
    const t = saveNewTaskFromModal();
    close();
    const baseDateISO = qs("datePicker").value;
    const baseDate = fromISODate(baseDateISO);
    renderWeekTasks(baseDate);
    renderMonthDots(baseDate);
    rescheduleTimer();
  }
  function onDelete() {
    // no-op for new task modal
    close();
  }
  function onClose() {
    close();
  }

  form.addEventListener("submit", onSubmit);
  deleteBtn.addEventListener("click", onDelete);
  closeBtn.addEventListener("click", onClose);
}