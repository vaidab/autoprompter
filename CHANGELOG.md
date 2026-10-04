# Changelog

## 0.1.0 — release candidate (not yet published)

First source release for Apple Silicon macOS, tested in Chrome.

- Local Romanian recognition through Parakeet MLX; no recording or cloud transcription.
- Separate setup and reading windows/tabs with saved size, font, spacing, and fixed-scroll speed presets.
- Approximate phrase following in either direction, limited to visible words. Repetitions move backward; off-script speech holds position.
- Smooth voice scrolling, gray read progress, and a translucent green current word.
- Markdown headings, emphasis, lists, and silent emoji cues.
- Microphone selection, pause/reset, fixed-speed mode, model retry, and one launch/quit workflow.
- GPL-3.0-only license, contributor documentation, and unit/build CI.

### Known limitations

- Requires Node.js, uv, Chrome, dependencies, and an initial model download of approximately 2.5 GB.
- No signed `.app`, DMG, auto-updater, or standalone offline installer.
- Recognition arrives in phrases; highlighting marks the last confirmed word, not instantaneous word timing.
- An offscreen sentence must be scrolled into view before recognition can jump to it.
- Gray progress includes skipped words before the current position.
- Natural delivery, noise, sleep/wake, long sessions, and other browsers need broader validation.
- Run `npm ci --prefix web` after updates, then refresh both pages.
