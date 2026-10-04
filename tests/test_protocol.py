import numpy as np
import pytest
from server.protocol import validate_audio, allowed_origin


def test_reject_wrong_origin():
    assert allowed_origin("http://127.0.0.1:8765", "127.0.0.1:8765")
    assert not allowed_origin("https://evil.example", "127.0.0.1:8765")
    assert not allowed_origin("http://127.0.0.1:8765", "evil.example")


def test_audio_validation_and_generation():
    h = {
        "generation": 2,
        "sequence": 1,
        "sampleRate": 16000,
        "viewport": {
            "generation": 2,
            "revision": 1,
            "visibleIds": [1, 2],
            "anchorId": 1,
        },
    }
    pcm = np.zeros(1600, dtype="<f4").tobytes()
    assert validate_audio(h, pcm, 2)["sequence"] == 1
    for bad in [
        {**h, "sampleRate": 48000},
        {**h, "generation": 1},
        {**h, "viewport": {**h["viewport"], "generation": 1}},
    ]:
        with pytest.raises(ValueError):
            validate_audio(bad, pcm, 2)
    with pytest.raises(ValueError):
        validate_audio(h, b"bad", 2)
    with pytest.raises(ValueError):
        validate_audio(h, np.array([np.nan], dtype="<f4").tobytes(), 2)
