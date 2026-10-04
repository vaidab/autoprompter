from typing import Protocol, Callable
from urllib.parse import urlsplit
import numpy as np


class SpeechWorkerPort(Protocol):
    def load(self): ...
    def submit(self, frame: dict): ...
    def reset(self): ...
    def stop(self): ...


def allowed_origin(origin: str | None, host: str) -> bool:
    return host in {"127.0.0.1:8765", "127.0.0.1:5173", "testserver"} and origin in {
        "http://127.0.0.1:8765",
        "http://127.0.0.1:5173",
    }


def validate_viewport(v: dict, generation: int) -> dict:
    if not isinstance(v, dict) or v.get("generation") != generation:
        raise ValueError("Old viewport")
    ids = v.get("visibleIds")
    revision = v.get("revision")
    if (
        not isinstance(ids, list)
        or len(ids) > 10000
        or any(type(x) != int or x < 0 for x in ids)
    ):
        raise ValueError("Invalid visible text")
    if type(revision) != int or revision < 0:
        raise ValueError("Invalid layout revision")
    if v.get("anchorId") is not None and (
        type(v["anchorId"]) != int or v["anchorId"] < 0
    ):
        raise ValueError("Invalid anchor")
    return v


def validate_audio(header: dict, data: bytes, generation: int) -> dict:
    if header.get("generation") != generation or header.get("sampleRate") != 16000:
        raise ValueError("Old audio or wrong sample rate")
    if type(header.get("sequence")) != int or header["sequence"] < 0:
        raise ValueError("Invalid sequence")
    validate_viewport(header.get("viewport"), generation)
    if not data or len(data) % 4 or len(data) > 16000 * 4 * 5:
        raise ValueError("Invalid PCM size")
    samples = np.frombuffer(data, dtype="<f4")
    if not np.isfinite(samples).all() or np.abs(samples).max() > 2:
        raise ValueError("Invalid PCM values")
    return {**header, "samples": samples.copy()}
