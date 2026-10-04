# Publishing a source release

Candidate: **v0.1.0**, recommended as a GitHub **pre-release** while broader real-use validation is pending. These instructions do not create a remote, tag, or GitHub release.

## Before tagging

1. Review `git status` and the intended commit. Keep versions consistent in `pyproject.toml`, `web/package.json`, lockfiles, and `/api/health` (`server/app.py`).
2. Run the checks in [CONTRIBUTING.md](../CONTRIBUTING.md). On Apple Silicon, run the full Chrome suite with an authorized Romanian fixture as described in [validation.md](validation.md).
3. Try a clean extracted source archive on Apple Silicon: install prerequisites, launch, download/load the model, open both windows, grant microphone permission, read the sample, repeat a visible phrase, pause, quit, and relaunch. Existing-cache tests do not establish a clean first-run installation.
4. Review `git ls-files`: exclude credentials, personal scripts, recordings, `.venv`, `node_modules`, `.runtime`, and build output. `.gitignore` does not remove tracked files. Include LICENSE, both lockfiles, README, and the executable launcher.
5. Add the actual publication date to [CHANGELOG.md](../CHANGELOG.md); record checks in [validation.md](validation.md). Preserve limitations and avoid unmeasured latency/all-browser claims.

## On GitHub

Choose the repository owner/name and visibility, configure its remote, and push the reviewed commit when publication is authorized. Wait for **Checks** to pass; it covers unit tests/build, not MLX or browser tests.

Tag that exact commit `v0.1.0`, create **Autoprompter v0.1.0**, select **Set as a pre-release**, and use the CHANGELOG entry as release notes. GitHub's source ZIP/tarball is sufficient. Do not attach installed dependencies, `.runtime`, or weights; no custom installer is provided.

Download the published archive once to check the launcher and documentation links. Local commits/files are preparation, not publication.
