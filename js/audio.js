// Audio (SRP): text-to-speech with beep fallback, respects silent mode
// Uses localStorage 'silent' flag set by app.js

function isSilent() {
  try {
    return localStorage.getItem("silent") === "true";
  } catch (e) {
    console.warn("TimeBlocking: unable to read silent flag from localStorage, assuming not silent", e);
    return false;
  }
}

function canSpeak() {
  return typeof window.speechSynthesis !== "undefined";
}

function speakText(text) {
  if (isSilent()) return;
  if (!canSpeak()) {
    beep();
    return;
  }
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    speechSynthesis.speak(utter);
  } catch {
    beep();
  }
}

let audioCtx;
let audioUnlocked = false;

export function unlockAudio() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx || new Ctor();

    // On mobile (including Android Chrome), AudioContext may start or return to "suspended"
    // after tab visibility changes. Always try to resume so beeps can work again.
    if (audioCtx.state === "suspended" || audioCtx.state === "interrupted") {
      audioCtx.resume().catch(() => {});
    }

    audioUnlocked = audioCtx.state === "running";
  } catch {
    // ignore
  }
}

/** Simple beep fallback */
function playTone(ctx, durationMs, freq, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  setTimeout(() => {
    osc.stop();
    osc.disconnect();
    gain.disconnect();
  }, durationMs);
}

export function beep(durationMs = 500, freq = 880, volume = 0.2) {
  if (isSilent()) return;
  try {
    unlockAudio();
    if (!audioCtx) return;

    if (audioCtx.state !== "running") {
      // Best-effort resume for mobile browsers (including Android Chrome) that
      // may suspend the context when the tab/app goes to the background.
      audioCtx
        .resume()
        .then(() => {
          if (audioCtx && audioCtx.state === "running") {
            playTone(audioCtx, durationMs, freq, volume);
          }
        })
        .catch(() => {});
      return;
    }

    playTone(audioCtx, durationMs, freq, volume);
  } catch {
    // no-op
  }
}

export function chime() {
  if (isSilent()) return;
  beep(250, 740, 0.15);
  setTimeout(() => beep(300, 980, 0.18), 300);
}

export function say(text) {
  speakText(text);
}

// Notifications (foreground/background)
export async function notify(title, body) {
  if (isSilent()) return;
  try {
    // Try service worker notifications if available
    if ("serviceWorker" in navigator && "showNotification" in (await navigator.serviceWorker.ready)) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "assets/icons/icon.svg",
        badge: "assets/icons/icon.svg",
        vibrate: [50, 50, 50],
        tag: "time-blocking",
        renotify: true,
      });
      return;
    }
  } catch {
    // fall through
  }
  // Fallback to Notification API
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }
}

export async function requestPermissions() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    // ignore
  }
}