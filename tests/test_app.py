from fastapi.testclient import TestClient
from server.app import create_app
from server.worker import WindowBuffer
import numpy as np
import time

ORIGIN = {"origin": "http://127.0.0.1:8765"}


class Worker:
    def load(self):
        pass

    def poll(self):
        return []

    def reset(self):
        pass

    def stop(self):
        pass

    def submit(self, frame):
        pass


def receive_type(ws, kind):
    while True:
        message = ws.receive_json()
        if message["type"] == kind:
            return message


def test_socket_ownership_preferences_and_quit():
    stopped = []
    app = create_app(Worker(), lambda: stopped.append(True))
    with TestClient(app) as client:
        assert client.get("/api/health").json()["app"] == "autoprompter"
        with client.websocket_connect("/ws", headers=ORIGIN) as setup:
            setup.send_json({"role": "setup"})
            welcome = receive_type(setup, "welcome")
            state = receive_type(setup, "state")["state"]
            assert state["owner"] == welcome["id"]
            with client.websocket_connect("/ws", headers=ORIGIN) as p:
                p.send_json({"role": "prompter"})
                receive_type(p, "welcome")
                receive_type(p, "state")
                setup.send_json(
                    {
                        "type": "preferences",
                        "script": "Astăzi vorbim despre încredere.",
                        "preset": state["preset"],
                    }
                )
                while receive_type(p, "state")["state"]["script"] == "":
                    pass
                setup.send_json({"type": "start", "mode": "fixed"})
                assert receive_type(p, "state")["state"]["status"] == "scrolling"
                p.send_json({"type": "quit"})
                assert receive_type(p, "stopped")["type"] == "stopped"
        assert stopped == [True]


def test_closing_secondary_setup_preserves_current_audio_window():
    class BufferWorker(Worker):
        def __init__(self):
            self.buffer = WindowBuffer()

        def reset(self):
            self.buffer.reset()

        def submit(self, frame):
            self.buffer.push(frame)

    worker = BufferWorker()
    app = create_app(worker)
    app.state.session.model = "ready"
    with TestClient(app) as client:
        with (
            client.websocket_connect("/ws", headers=ORIGIN) as setup,
            client.websocket_connect("/ws", headers=ORIGIN) as prompter,
        ):
            setup.send_json({"role": "setup"})
            receive_type(setup, "welcome")
            receive_type(setup, "state")
            prompter.send_json({"role": "prompter"})
            receive_type(prompter, "welcome")
            receive_type(prompter, "state")
            with client.websocket_connect("/ws", headers=ORIGIN) as secondary:
                secondary.send_json({"role": "setup"})
                receive_type(secondary, "welcome")
                receive_type(secondary, "state")
                setup.send_json({"type": "start", "mode": "voice"})
                while receive_type(setup, "state")["state"]["status"] != "listening":
                    pass
                generation = app.state.session.generation
                header = dict(
                    type="audio",
                    generation=generation,
                    sequence=1,
                    sampleRate=16000,
                    viewport=dict(
                        generation=generation,
                        revision=1,
                        visibleIds=[0, 1, 2],
                        anchorId=0,
                    ),
                )
                setup.send_json(header)
                setup.send_bytes((np.ones(8000, dtype="<f4") * 0.1).tobytes())
                deadline = time.monotonic() + 2
                while len(worker.buffer.samples) < 8000 and time.monotonic() < deadline:
                    time.sleep(0.01)
                assert len(worker.buffer.samples) == 8000
            # State broadcast happens after the secondary socket is removed.
            while receive_type(setup, "state")["state"]["status"] != "listening":
                pass
            time.sleep(0.05)
            assert len(worker.buffer.samples) == 8000
