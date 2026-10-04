# Autoprompter

A local Romanian teleprompter for Apple Silicon. White text, black background, silent emoji cues, and approximate voice following restricted to visible text.

**Release candidate: 0.1.0.** Source distribution with a local launcher; no signed macOS app or installer. Supported target: Apple Silicon macOS with Chrome. Intel Macs, Windows, Linux voice recognition, and other browsers have not been validated.

## Install from GitHub

1. Download and extract **Source code (zip)** from the release, or clone the repository using GitHub's **Code** button. Keep the whole folder together in a writable location.
2. Install [Node.js](https://nodejs.org/en/download) (22.12+ in the 22.x line, or 24.x), [uv](https://docs.astral.sh/uv/getting-started/installation/), and [Chrome](https://www.google.com/chrome/). npm comes with Node.js. uv manages Python; Python 3.12 is the tested runtime.
3. Open Terminal in the project folder and run:

   ```sh
   chmod +x "Start Prompter.command"
   ./"Start Prompter.command"
   ```

   Later launches can use a double-click in Finder. If macOS blocks a downloaded file, use the per-file **Open** option after verifying its source; do not disable macOS security globally.
4. Wait for dependency installation and the first speech-model download. If your default browser is not Chrome, open `http://127.0.0.1:8765` in Chrome yourself.
5. Paste a script, open the prompter, select **Start following**, and grant microphone permission to the local page.

Allow approximately 2.5 GB for the model **plus** dependencies and caches. Installation time and memory use depend on the Mac; no minimum-RAM or latency guarantee has been established.

See [the sample Romanian script](examples/romanian.md), [release notes](CHANGELOG.md), and [validation results](docs/validation.md).

## Start and stop

Double-click **Start Prompter.command** in Finder. The launcher builds the browser app, starts the local service, loads Parakeet, and opens http://127.0.0.1:8765. Keep its Terminal window open while using the app. Starting again reopens the existing service.

Paste your script, choose a preset, and open the prompter in a separate window or tab. Click **Start following** on Setup and allow microphone access. Leave Setup open; it owns the microphone. Use **Pause** to stop capture while retaining the model, or **Quit Prompter** to stop the local service completely. Closing all pages also stops it after 15 seconds. Launch the same command to start again.

Choose **Fixed-speed scrolling** for manual pacing without microphone access. Space pauses/resumes outside inputs; wheel/trackpad navigation remains available. Reset returns to the beginning.

## First setup

Requires an Apple Silicon Mac, Node.js 20.19+ or 22.12+, and [uv](https://docs.astral.sh/uv/). Chrome is the browser used for verification. The launcher installs Python dependencies into this folder's `.venv` and JavaScript dependencies into `web/node_modules`. A Python 3.11–3.13 runtime is selected by uv. If double-click execution is unavailable, run `./"Start Prompter.command"` from Terminal.

The first model download is approximately 2.5 GB, cached under `.runtime/models`. Internet is needed for initial dependencies and model download. Once installed, recognition and browser assets run locally; audio is held in memory, never saved. Speech is not sent to a cloud recognizer. No API key is needed. The repository uses [Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) via the [community MLX runtime](https://github.com/senstella/parakeet-mlx); respect their respective licenses when redistributing models or runtime code.

## Following behavior

The prompter renders Markdown headings, **bold**, *italics*, lists, and other basic text formatting. Paste Markdown directly in Setup; formatting markers and link destinations are excluded from spoken matching. Pasted HTML remains literal text; images show their alternative text without loading external media.

The last recognized word has a translucent green background. Earlier words turn gray to show progress; repeating an earlier visible phrase moves this boundary backward. This marks the current reading position, so skipped words before it also appear gray. Reset clears the markers. Voice-follow scrolling eases toward each confirmed position and stops on Pause or manual navigation. The system's Reduce Motion preference uses immediate positioning.

Matching ignores case, punctuation, emoji decorations, and Romanian diacritic variants. It tolerates fillers, omissions, and modest substitutions. It does not interpret broad paraphrases semantically. When uncertain or off-script, it holds. Speaking an earlier visible phrase can move backward. Off-screen phrases are never eligible: scroll them into view first.

Avoid identical short phrases in several visible places where possible. The app holds when it cannot distinguish them. A visible prompter must remain open; switching away from a prompter tab pauses it. A separate window is useful when keeping Setup accessible.

Presets save window content dimensions, font size, line spacing, and fixed-scroll speed in browser storage. Popup dimensions are best effort; browsers control frame size and positioning. Tab mode constrains the reading area without resizing the browser. Scripts and presets are stored per browser at the stable local origin.

## Recovery

- Microphone denied: allow microphone access for the localhost page, select a microphone, and start again.
- Model error: use **Retry model**. Manual scrolling remains available.
- Window blocked: use **Open tab**.
- Another setup tab controls the app: close that tab to release ownership.
- Service stopped/disconnected: open **Start Prompter.command** again.
- Port 8765 occupied: close the conflicting application. The launcher never kills an unrelated process.
- `uv`, `node`, or `npm` not found: install the prerequisites and reopen Terminal. Check `uv --version`, `node --version`, and `npm --version`.
- Dependency errors after updating: quit the app, run `npm ci --prefix web`, and launch again.
- Recognition is slow or inaccurate: check the selected microphone, reduce background noise, and use distinctive phrases. Fixed-speed mode remains available; phrase following is approximate, not instantaneous word timing.

## Update, privacy, and removal

Quit before updating. With Git, pull the new version; otherwise extract the new release into a separate folder. Run `npm ci --prefix web` after every update, then launch. The launcher refreshes Python dependencies from `uv.lock`, but installs JavaScript dependencies automatically only when `web/node_modules` is absent. Refresh both browser pages after updating.

Scripts and presets live in browser local storage for `http://127.0.0.1:8765`, not in the repository. Copy important scripts somewhere safe before clearing browser data or changing browser/profile. Replacing the project folder does not erase browser storage. Optionally copy `.runtime/models` from an older folder to avoid downloading the model again.

Audio and recognition results are processed in memory. There is no recording/export feature, account, API key, or cloud transcription. Initial installation contacts package registries and Hugging Face. The service listens on loopback; do not expose it to a network or public proxy.

To remove the app, quit and delete its project folder, including `.venv`, `web/node_modules`, and `.runtime`. Clear the local site's browser data separately to remove scripts and presets. uv, Node.js, and Chrome remain installed independently.

## License

Original Autoprompter code is **GPL-3.0-only**; see [LICENSE](LICENSE). Third-party libraries and speech weights retain their own licenses and are downloaded separately. See [third-party components](THIRD_PARTY.md).

## Development and verification

```sh
uv sync --locked --extra dev --extra speech
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
.venv/bin/pytest -q
.venv/bin/python -m server.launcher --no-browser
```

`cd web && npm run e2e` uses installed Chrome and starts local test servers automatically. Browser unit/layout tests use Vite on port 5173; integration tests use a separate service on port 8766, preserving any app session on port 8765. The test service translates its loopback origin to the production origin at the ASGI boundary; production origin rejection has separate Python coverage. Use port 8765 for normal operation. The real speech-pipeline test is opt-in through `AUTOPROMPTER_TEST_WAV`; ordinary tests do not use your physical microphone. See `docs/validation.md` for actual checks and remaining live speech validation.

See [contributor setup and CI scope](CONTRIBUTING.md) and [maintainer publication steps](docs/releasing.md).
