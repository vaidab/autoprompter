import numpy as np
from server.worker import WindowBuffer
from server.worker import SpeechWorker, put_latest
import multiprocessing as mp


def frame(seq, generation=1):
    return dict(
        sequence=seq,
        generation=generation,
        samples=np.ones(8000, dtype=np.float32) * 0.1,
        viewport={},
    )


def test_rolling_windows_are_bounded_and_reset():
    b = WindowBuffer()
    for i in range(20):
        out = b.push(frame(i))
    assert len(out["samples"]) == 64000 and out["sequence"] == 19
    fresh = b.push(frame(20, 2))
    assert len(fresh["samples"]) == 8000
    b.reset()
    assert b.push(frame(21, 2))["audioEndMs"] == 500


def test_silence_does_not_decode_stale_words():
    b = WindowBuffer()
    f = frame(0)
    f["samples"] *= 0
    assert b.push(f) is None


def test_pending_inference_always_replaces_old_audio_even_before_queue_flush():
    for _ in range(10):
        pending=mp.get_context('spawn').Queue(maxsize=1)
        try:
            pending.put('old')
            put_latest(pending,'new')
            assert pending.get(timeout=1)=='new'
        finally:
            pending.close()
            pending.join_thread()


def test_unexpected_worker_exit_is_reported_once():
    class DeadProcess:
        exitcode=-9
        def is_alive(self):return False
    worker=SpeechWorker();worker.process=DeadProcess()
    events=worker.poll()
    assert len(events)==1 and events[0]['status']=='error'
    assert worker.poll()==[]
