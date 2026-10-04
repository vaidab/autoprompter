# Contributing

Keep the app focused on local Romanian prompting. Preserve visible-only matching, silent emoji cues, and the absence of recording. Discuss larger features in an issue first. Contributions are under the repository's GPL-3.0-only license.

## Local setup

Use Apple Silicon macOS and Chrome for the complete app. From the repository root:

```sh
uv sync --locked --extra dev --extra speech --python 3.12
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
.venv/bin/pytest -q
cd web
npm run e2e
```

The browser suite starts its own service on 8766 and Vite on 5173; keep those ports free. Integration tests load the real speech model even when the optional audio fixture is absent. The fixture test is skipped unless `AUTOPROMPTER_TEST_WAV` points to an authorized mono 16 kHz Romanian WAV. Tests use fake browser capture, never your physical microphone. Do not commit recordings, private scripts, browser profiles, weights, or screenshots of private content.

For unit/backend work without MLX:

```sh
uv sync --locked --extra dev --python 3.12
uv run --locked --extra dev pytest -q
```

This path does not support live voice or the browser integration suite. GitHub CI runs this Python suite, frontend unit tests, and the production build on Linux. It does not certify Apple Silicon inference or browser behavior; check those locally before release.

## Pull requests and bug reports

Include the observed problem, expected behavior, reproduction steps, and a small nonprivate script. State macOS version, Mac model, Chrome version, release/commit, and whether voice or fixed-speed mode is affected. For matching issues, describe the spoken deviation and whether the target was visible. Avoid posting audio or private text by default.

Keep changes focused and add regression coverage for changed behavior. Run the applicable checks above. Dependency changes include `uv.lock` or `web/package-lock.json`; installed dependencies and build output stay untracked. Inspect UI changes on desktop and narrow windows, including Reduced Motion.
