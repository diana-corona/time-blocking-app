# Time Blocking

A minimal, privacy-friendly time blocking app that runs in your browser (and can be installed as a PWA). It helps you plan your day in blocks, stay focused during tasks, and get gentle reminders.

## What you can do

- **Plan your week**
  - Week view with hourly grid from early morning to late evening
  - Month view with dots showing which days have tasks
  - Drag tasks to reschedule them (including cross-day drag)
  - Create one-off or repeating tasks (by day of week)

- **Focus on the current task**
  - When a task is active, a **Task in progress** view appears:
    - Task title
    - End time
    - Remaining and elapsed time
    - Next upcoming task and its start time
  - Circular pie chart:
    - **Red** = time remaining
    - **White** = time that has already passed
  - You can **minimize** this view to a small floating button with a mini pie chart and reopen it with one tap/click.

- **Notifications (optional)**
  - Reminder 5 minutes before a task ends
  - Reminder 5 minutes before the next task starts
  - Warning when there is less than a 5‑minute break between tasks
  - Optional sounds and speech (can be muted with **Silent** toggle)
  - Uses the browser’s Notification API; you will be asked for permission once

- **Offline & privacy**
  - Works offline once loaded (Progressive Web App)
  - All data is stored locally in your browser
  - No accounts, no syncing, no external services

## Basic usage

1. **Pick a day** with the date picker or Today button.
2. **Add a task**
   - Click **New Task** or tap/double‑click a time slot in the week view.
   - Set title, start time, duration, color (optional), and recurrence (optional).
3. **See it on the calendar**
   - Tasks appear as colored blocks; drag to adjust time or move to other days.
4. **Let the app notify you**
   - Keep the tab or installed app open; allow notifications if you want reminders.
5. **Follow the Task in progress view**
   - When a task’s time window starts, the overlay appears automatically.
   - Minimize it if you want just the small floating indicator.

## Installing as an app

On most modern browsers (Chrome, Edge, some others):

1. Open the site.
2. Look for **“Install app”** / **“Add to Home Screen”** in the address bar menu.
3. Install to launch it like a native app.

## Limitations

- All data is kept in your current browser profile only.
- If you clear site data or use aggressive private modes, tasks may be removed.