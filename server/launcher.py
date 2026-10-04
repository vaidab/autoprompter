import fcntl
import json
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8765"


def acquire_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    file = path.open("a+")
    try:
        fcntl.flock(file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        file.close()
        return None
    return file


def should_shutdown(*, clients, had_clients, empty_for, grace=15):
    return clients == 0 and empty_for >= (grace if had_clients else 120)


def is_running():
    try:
        with urllib.request.urlopen(URL + "/api/health", timeout=1) as response:
            return json.load(response).get("app") == "autoprompter"
    except Exception:
        return False


def open_when_ready():
    for _ in range(80):
        if is_running():
            webbrowser.open(URL)
            return
        time.sleep(0.1)


def main():
    lock = acquire_lock(ROOT / ".runtime" / "service.lock")
    if lock is None:
        for _ in range(50):
            if is_running():
                webbrowser.open(URL)
                print("Opened the running prompter.")
                return 0
            time.sleep(0.1)
        print(
            "Prompter is starting or stopping. Try again in a few seconds.",
            file=sys.stderr,
        )
        return 1
    try:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", 8765))
            except OSError:
                if is_running():
                    webbrowser.open(URL)
                    return 0
                print(
                    "Port 8765 is used by another app. Close that app and launch again.",
                    file=sys.stderr,
                )
                return 1
        import uvicorn
        from .app import create_app
        from .worker import SpeechWorker

        worker = SpeechWorker()
        server = None

        def shutdown():
            if server:
                server.should_exit = True

        app = create_app(worker, shutdown)
        server = uvicorn.Server(
            uvicorn.Config(
                app,
                host="127.0.0.1",
                port=8765,
                log_level="warning",
                ws_max_size=640000,
            )
        )
        if "--no-browser" not in sys.argv:
            threading.Thread(target=open_when_ready, daemon=True).start()
        print(
            f"Autoprompter: {URL}\nUse Quit Prompter in the browser to stop.",
            flush=True,
        )
        server.run()
        return 0
    finally:
        lock.close()


if __name__ == "__main__":
    raise SystemExit(main())
