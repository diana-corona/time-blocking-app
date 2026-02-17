# Contributing

Thanks for your interest in improving the time‑blocking app. This project aims to stay **small, clear, and maintainable**, with a strong focus on **Single Responsibility Principle (SRP)** and consistent **commit messages**.

---

## 1. Design principles

### Single Responsibility Principle (SRP)

Each module/file should do **one thing well**.

- `js/app.js`  
  App bootstrap and wiring:
  - Initialize UI
  - Wire modules together
  - Global view switching (week/month)

- `js/tasks.js`  
  Task calendar concerns:
  - Render tasks into the calendar
  - Task modal integration
  - Drag & drop rescheduling

- `js/timer.js`  
  Time‑based behavior:
  - Build task instances over time windows (including recurrence)
  - Determine active / next / previous tasks
  - Schedule reminders and “short break” checks

- `js/audio.js`  
  Audio + notifications:
  - Beeps, chimes, speech synthesis
  - Browser / service‑worker notifications
  - Respect the `silent` flag

- `js/task-progress.js`  
  Task in‑progress UI:
  - Overlay and mini floating indicator
  - Pie chart (remaining vs passed time)
  - Display end time, elapsed/remaining, and next task info

- CSS files (`css/*.css`)  
  Grouped by concern (layout, calendar, tasks, responsive, task‑progress).

**When adding new features:**

- Prefer **a new module** if the logic is conceptually separate.
- If adding to an existing file, keep changes aligned with that file’s responsibility.
- Avoid mixing:
  - UI and data storage
  - Timer logic and DOM operations
  - Multiple unrelated features in the same module

---

## 2. Commit message convention

Use the pattern:

`<type>[optional scope]: <description>`

- **type** (lowercase, required):
  - `feat` – new feature
  - `fix` – bug fix
  - `docs` – documentation only
  - `style` – formatting, no logic change (whitespace, etc.)
  - `refactor` – code refactor without behavior change
  - `test` – add or update tests
  - `chore` – tooling, configs, maintenance
  - `build` – build system changes
  - `ci` – CI configuration

- **scope** (optional, in parentheses):  
  Short, lowercase target area:
  - `app`, `tasks`, `timer`, `audio`, `task-progress`, `calendar`, `readme`, etc.

- **description**:
  - Short, imperative, present tense
  - Lowercase start is fine
  - No trailing period

### Examples

- `feat(task-progress): add active task progress overlay with pie chart`
- `docs(readme): add usage guide for users`
- `fix(timer): correct next task warning window`
- `refactor(tasks): simplify drag and drop logic`
- `style(calendar): adjust spacing in week header`

---

## 3. Practical guidelines

- Keep PRs / change sets **small and focused** on one concern.
- Prefer **clear names** over clever ones.
- Maintain existing patterns (DOM APIs, module style, no heavy frameworks).
- Test on both:
  - Desktop layout (full week view)
  - Narrow viewport / mobile (single‑day view)

If you’re unsure where a change belongs, pick the **closest existing module** by responsibility, or split into a new module and keep the interface as small and clear as possible.