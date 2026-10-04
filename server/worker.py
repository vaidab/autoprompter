import multiprocessing as mp
import queue
import time
import numpy as np


def transcript_event(frame, result, inference_ms):
    offset_ms = frame["audioEndMs"] - len(frame["samples"]) / 16
    return {
        k: v
        for k, v in {
            **frame,
            "type": "transcript",
            "text": result.text,
            "speechEndMs": offset_ms + result.speech_end_ms,
            "inferenceMs": inference_ms,
        }.items()
        if k not in ("samples", "sampleRate")
    }


class WindowBuffer:
    def __init__(self):
        self.reset()

    def reset(self):
        self.samples = np.empty(0, dtype=np.float32)
        self.generation = None
        self.elapsed = 0

    def push(self, frame):
        if frame["generation"] != self.generation:
            self.reset()
            self.generation = frame["generation"]
        incoming = frame["samples"]
        self.elapsed += len(incoming)
        self.samples = np.concatenate((self.samples, incoming))[-64000:]
        if not len(incoming) or float(np.sqrt(np.mean(incoming**2))) < 0.003:
            return None
        return {
            **frame,
            "samples": self.samples.copy(),
            "audioEndMs": self.elapsed / 16,
        }


def put_latest(q, item):
    try:
        q.put_nowait(item)
    except queue.Full:
        try:
            # multiprocessing.Queue's feeder can hold the old item briefly
            # after put() has claimed the slot. Allow that bounded flush.
            q.get(timeout=0.02)
        except queue.Empty:
            pass
        try:
            q.put(item, timeout=0.02)
        except queue.Full:
            pass


def run_worker(incoming, outgoing):
    from .speech import ParakeetRecognizer

    def report(status, detail):
        outgoing.put({"type": "model", "status": status, "detail": detail})

    recognizer = ParakeetRecognizer(report)
    try:
        recognizer.load()
    except Exception as e:
        report("error", f"Could not load speech model: {e}. Use Retry model.")
        return
    while True:
        frame = incoming.get()
        if frame is None:
            break
        start = time.monotonic()
        try:
            result = recognizer.decode(frame["samples"])
            outgoing.put(
                transcript_event(
                    frame, result, round((time.monotonic() - start) * 1000)
                )
            )
        except Exception as e:
            report("error", f"Speech recognition stopped: {e}. Use Retry model.")
            break
    recognizer.close()


class SpeechWorker:
    def __init__(self):
        self.ctx = mp.get_context("spawn")
        self.process = None
        self.buffer = WindowBuffer()
        self.incoming = None
        self.outgoing = None
        self.reported_exit = False

    def load(self):
        if self.process and self.process.is_alive():
            return
        self.incoming = self.ctx.Queue(maxsize=1)
        self.outgoing = self.ctx.Queue()
        self.buffer.reset()
        self.reported_exit = False
        self.process = self.ctx.Process(
            target=run_worker, args=(self.incoming, self.outgoing), daemon=True
        )
        self.process.start()

    def submit(self, frame):
        window = self.buffer.push(frame)
        if window is not None and self.incoming is not None:
            put_latest(self.incoming, window)

    def reset(self):
        self.buffer.reset()
        if self.incoming is not None:
            try:
                while True:
                    self.incoming.get_nowait()
            except queue.Empty:
                pass

    def poll(self):
        events = []
        if self.outgoing is not None:
            try:
                while True:
                    events.append(self.outgoing.get_nowait())
            except queue.Empty:
                pass
        if any(event.get('status') == 'error' for event in events):
            self.reported_exit = True
        if self.process and not self.process.is_alive() and not self.reported_exit:
            self.reported_exit = True
            events.append({
                'type': 'model', 'status': 'error',
                'detail': 'The speech worker stopped unexpectedly. Use Retry model.',
            })
        return events

    def stop(self):
        if self.process:
            if self.incoming is not None:
                put_latest(self.incoming, None)
            self.process.join(timeout=2)
            if self.process.is_alive():
                self.process.terminate()
                self.process.join(timeout=2)
            self.process = None
        self.buffer.reset()
