# Validation record

Validation covers local speech recognition, visible-only phrase following, reading controls, and Markdown display.

## Release preparation — 2026-10-04

Current candidate: **0.1.0**, not yet tagged or published. Fresh checks on this Apple Silicon Mac passed **19 frontend unit tests, 14 Python tests, 19 Chrome tests**, and the production build. Chrome included the synthesized Romanian fixture through real Parakeet. No physical microphone was used by these tests.

A separate clean source copy installed JavaScript dependencies with `npm ci` and Python development dependencies with `uv sync --locked --extra dev --python 3.12`; all 33 unit tests and the build passed there too. This validates dependency installation without reusing the app's installed environments, but does not establish a fresh model download or a second-Mac first launch. The installed npm dependency audit reported zero vulnerabilities at the time of this check; this is not a full security audit.

Checked source inventory, local documentation links, version/license metadata, launcher shell syntax, and workflow YAML parsing. No model weights, recordings, installed dependencies, or runtime data are tracked. The source license is GPL-3.0-only. Linux CI covers unit tests and build only; see the repository's Actions tab for current results.

Before a stable public release, complete the clean-install and real-use steps in [releasing.md](releasing.md). Older sections below preserve validation history rather than replacing the current counts above.

## Automated and local checks

Final run on 2026-10-02: `npm test --prefix web` passed 16 tests; `.venv/bin/pytest -q` passed 14 tests; `npm run build --prefix web` passed; the complete Chrome suite with the Romanian audio fixture passed 14 tests. The final four control regressions were observed failing before their fixes and passing afterward.

- Romanian tokenization, silent emoji (including numbered keycaps), normalization, preset storage, phrase alignment, ambiguous duplicates, and visibility-generation filtering have focused unit tests.
- Streaming resampling is checked at 44.1 kHz and 48 kHz, including attenuation above the 16 kHz output's Nyquist frequency.
- Python tests exercise session ownership, malformed/stale audio rejection, rolling buffer boundaries, inference timestamp conversion, launch locking, and shutdown grace.
- Chrome tests cover literal text rendering, narrow layouts, viewport clipping, visible-only forward/backward moves, transcript revisions, navigation before server acknowledgment, settings ownership and takeover, and fixed-speed pause/reset.
- An opt-in browser test sends a synthesized Romanian WAV through Chrome's fake microphone, the actual AudioWorklet, local WebSocket service, real Parakeet MLX model, and the real matching/scrolling UI. This passed on this Apple Silicon Mac. No physical microphone was used.
- Desktop setup, narrow setup, and prompter screenshots were inspected. Test screenshots are kept in `.runtime/screenshots` and are not product assets.

## Speech measurement

The test passage was synthesized locally with macOS's Romanian Ioana voice. Parakeet MLX 0.5.3 used `mlx-community/parakeet-tdt-0.6b-v3`, cached in `.runtime/models`. A 16 kHz mono 8.93-second WAV was decoded as overlapping windows up to four seconds long.

Observed model load/warm-up: 1.315 seconds. Decode times for four successive test windows: 1.187, 0.200, 0.103, and 0.113 seconds. This is a small local inference measurement, not a guarantee of speech-to-scroll latency. Buffering, phrase evidence, browser scheduling, and rendering add delay. The recognizer made some substitutions on partial words at window boundaries; approximate matching is intended to tolerate modest recognition differences.

To repeat the opt-in test, supply a mono 16 kHz fixture and run from `web`:

```sh
AUTOPROMPTER_TEST_WAV=/absolute/path/to/romanian.wav npm run e2e -- voice.spec.ts
```

For inference measurements without a browser:

```sh
.venv/bin/python scripts/benchmark_speech.py /absolute/path/to/romanian.wav
```

## Remaining real-use validation

Your voice, microphone, room noise, delivery pace, and long-session behavior have not been measured. Try reading naturally, omitting a few words, improvising, returning three visible lines ahead, and repeating an earlier visible sentence. Text outside the visible reading area should never become an automatic jump target. Pause must release the browser's microphone indicator.

## Review history

Verification identified and resolved settings-ownership bypass, stale navigation updates, transcript-revision backtracking, numbered-emoji handling, duplicate-phrase ambiguity, hidden-prompter startup, Space-shortcut microphone eligibility, and disappearing microphone-loss guidance. Regression tests cover these fixes. Physical microphone performance and long sessions remain outside automated validation.

## Reading-window improvements (2026-10-02)

Approved changes: continuous eased voice scrolling, gray progress before the current position, a translucent green current word, and rendered Markdown. Progress follows backward repetition and resets; matching uses displayed words including words split across formatting nodes. Only fully visible token fragments qualify for matching.

The three feature regressions failed against the baseline and passed after implementation. A numerical regression reproduced a bounce caused by retained velocity after a mid-animation target crossing and passed after the fix. Chrome desktop and narrow screenshots were inspected. Reduced-motion positioning and cancellation on pause/manual navigation are covered.

Final checks: 19 frontend unit tests, 14 Python tests, 19 Chrome tests including synthesized Romanian speech through actual Parakeet, and production build passed. An earlier full run had four session/audio tests blocked by the user's existing setup ownership on port 8765. Browser integration tests now run on their own service at 8766; the complete rerun passed. Other browsers and natural microphone latency were not revalidated in this change.
