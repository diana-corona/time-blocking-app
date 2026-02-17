import { getActiveTaskInfo, getNextTaskInfo } from "./timer.js";

const REFRESH_INTERVAL_MS = 1000;

let overlayEl;
let miniEl;
let titleEl;
let endTimeEl;
let remainingEl;
let elapsedEl;
let nextTitleEl;
let nextTimeEl;
let overlayCanvas;
let miniCanvas;
let overlayCtx;
let miniCtx;

let isExpanded = true; // overlay vs mini
let refreshTimerId = null;

function createElements() {
  if (overlayEl) return;

  // Overlay
  overlayEl = document.createElement("div");
  overlayEl.id = "taskProgressOverlay";
  overlayEl.className = "task-progress-overlay hidden";

  const card = document.createElement("div");
  card.className = "task-progress-card";

  const header = document.createElement("header");
  header.className = "task-progress-header";

  titleEl = document.createElement("h2");
  titleEl.className = "task-progress-title";

  endTimeEl = document.createElement("div");
  endTimeEl.className = "task-progress-end";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "task-progress-minimize-btn";
  closeBtn.textContent = "Minimize";
  closeBtn.addEventListener("click", () => {
    isExpanded = false;
    syncVisibility();
  });

  header.appendChild(titleEl);
  header.appendChild(endTimeEl);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "task-progress-body";

  const chartWrap = document.createElement("div");
  chartWrap.className = "task-progress-chart";

  overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = 200;
  overlayCanvas.height = 200;
  chartWrap.appendChild(overlayCanvas);

  const infoWrap = document.createElement("div");
  infoWrap.className = "task-progress-info";

  remainingEl = document.createElement("div");
  remainingEl.className = "task-progress-remaining";

  elapsedEl = document.createElement("div");
  elapsedEl.className = "task-progress-elapsed";

  nextTitleEl = document.createElement("div");
  nextTitleEl.className = "task-progress-next-title";

  nextTimeEl = document.createElement("div");
  nextTimeEl.className = "task-progress-next-time";

  infoWrap.appendChild(remainingEl);
  infoWrap.appendChild(elapsedEl);
  infoWrap.appendChild(nextTitleEl);
  infoWrap.appendChild(nextTimeEl);

  body.appendChild(chartWrap);
  body.appendChild(infoWrap);

  card.appendChild(header);
  card.appendChild(body);
  overlayEl.appendChild(card);

  // Mini floating indicator
  miniEl = document.createElement("button");
  miniEl.id = "taskProgressMini";
  miniEl.type = "button";
  miniEl.className = "task-progress-mini hidden";
  miniEl.setAttribute("aria-label", "Show active task progress");
  miniEl.addEventListener("click", () => {
    isExpanded = true;
    syncVisibility();
  });

  miniCanvas = document.createElement("canvas");
  miniCanvas.width = 48;
  miniCanvas.height = 48;
  miniEl.appendChild(miniCanvas);

  document.body.appendChild(overlayEl);
  document.body.appendChild(miniEl);

  const oc = overlayCanvas.getContext("2d");
  const mc = miniCanvas.getContext("2d");
  overlayCtx = oc || null;
  miniCtx = mc || null;
}

function formatHm(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatTimeOfDay(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function drawPie(ctx, width, height, remainingFrac) {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 4;

  const startAngle = -Math.PI / 2;
  const fullCircle = Math.PI * 2;

  // Background: elapsed (white)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, fullCircle);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Remaining: red slice
  const remainingAngle = fullCircle * Math.max(0, Math.min(1, remainingFrac));
  if (remainingAngle > 0.001) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + remainingAngle, false);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();
  }

  // Optional: inner circle for donut style
  const innerRadius = radius * 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, fullCircle);
  ctx.fillStyle = "#0b1220";
  ctx.fill();
}

function syncVisibility(hasActive) {
  if (!overlayEl || !miniEl) return;

  if (!hasActive) {
    overlayEl.classList.add("hidden");
    miniEl.classList.add("hidden");
    return;
  }

  if (isExpanded) {
    overlayEl.classList.remove("hidden");
    miniEl.classList.add("hidden");
  } else {
    overlayEl.classList.add("hidden");
    miniEl.classList.remove("hidden");
  }
}

function update() {
  const active = getActiveTaskInfo();
  const hasActive = !!active;
  syncVisibility(hasActive);

  if (!active) {
    return;
  }

  const nowMs = Date.now();
  const { task, startMs, endMs } = active;
  const totalMs = Math.max(1, endMs - startMs);
  const elapsedMs = Math.max(0, Math.min(nowMs - startMs, totalMs));
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingFrac = remainingMs / totalMs;

  if (titleEl) {
    titleEl.textContent = task.title || "Active task";
  }
  if (endTimeEl) {
    endTimeEl.textContent = `Ends at ${formatTimeOfDay(endMs)}`;
  }
  if (remainingEl) {
    remainingEl.textContent = `Remaining: ${formatHm(remainingMs)}`;
  }
  if (elapsedEl) {
    elapsedEl.textContent = `Elapsed: ${formatHm(elapsedMs)}`;
  }

  const next = getNextTaskInfo();
  if (next && nextTitleEl && nextTimeEl) {
    nextTitleEl.textContent = `Next: ${next.task.title}`;
    nextTimeEl.textContent = `Starts at ${formatTimeOfDay(next.startMs)}`;
  } else {
    if (nextTitleEl) nextTitleEl.textContent = "Next: —";
    if (nextTimeEl) nextTimeEl.textContent = "";
  }

  if (overlayCtx && overlayCanvas) {
    drawPie(overlayCtx, overlayCanvas.width, overlayCanvas.height, remainingFrac);
  }
  if (miniCtx && miniCanvas) {
    drawPie(miniCtx, miniCanvas.width, miniCanvas.height, remainingFrac);
  }
}

export function initTaskProgressView() {
  createElements();

  if (refreshTimerId !== null) {
    window.clearInterval(refreshTimerId);
  }
  // Initial state: expanded when first shown
  isExpanded = true;
  update();
  refreshTimerId = window.setInterval(update, REFRESH_INTERVAL_MS);
}