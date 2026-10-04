from types import SimpleNamespace
from server.speech import recognition_from_results
from server.worker import transcript_event
import numpy as np


def test_model_timestamps_are_relative_to_the_rolling_audio_window():
    result = recognition_from_results(
        [SimpleNamespace(text="Astăzi vorbim.", sentences=[SimpleNamespace(end=1.2)])]
    )
    frame = dict(
        samples=np.zeros(64000), audioEndMs=7000, sequence=4, generation=1, viewport={}
    )
    event = transcript_event(frame, result, 85)
    assert event["speechEndMs"] == 4200
    assert event["text"] == "Astăzi vorbim."
    assert "samples" not in event


def test_silence_has_no_recognized_speech_timestamp():
    result = recognition_from_results([])
    assert result.text == "" and result.speech_end_ms == 0
