# Claude Phone Edits

A running log of every change Claude makes during **phone / mobile sessions**,
recorded **in the order it happens**. When you're back at the computer, read
this top-to-bottom to see exactly what changed and in what sequence, then
reconcile against the "original."

## How to read this

- Entries are **chronological** — oldest at the top, newest appended at the
  bottom. Reading down = replaying the session in order.
- Each entry lists the **file(s) touched**, **what changed**, and **why**.
- The `[commit]` tag (if present) links the edit to a git commit on this
  branch, so you can `git show` the exact diff on the computer.
- Once you've reconciled a batch on the computer, delete those entries (or move
  them under a `## Reconciled` heading) to keep the live list short.

## Branch

All phone-session work lands on: `claude/file-review-jdleyy`

---

## Log

### 001 — 2026-07-19 — Session start
- **File:** `CLAUDE_PHONE_EDITS.md` (new)
- **What:** Created this tracking file.
- **Why:** Establish an ordered record of phone-session edits so the desktop
  copy can be reconciled precisely.
- **Code changes:** none yet.

<!--
ENTRY TEMPLATE (copy for each new edit):

### NNN — YYYY-MM-DD — short title
- **File:** path/to/file.js (function / area)
- **What:** one-line summary of the change
- **Why:** the reason / goal
- **Before → After:** old behavior/value → new behavior/value  (optional but useful)
- **[commit]:** <hash>  (optional)
-->
