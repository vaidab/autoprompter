"""Exercise real MLX inference with a local WAV; never accesses the microphone."""

import json
import sys
import time
from pathlib import Path

import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.speech import ParakeetRecognizer


def main():
    samples, rate = sf.read(sys.argv[1], dtype="float32")
    if rate != 16000 or samples.ndim != 1:
        raise SystemExit("Supply a mono 16 kHz WAV.")
    model = ParakeetRecognizer()
    start = time.monotonic()
    model.load()
    load_seconds = time.monotonic() - start
    results = []
    for end in range(16000 * 2, len(samples) + 1, 16000 * 2):
        window = samples[max(0, end - 64000) : end]
        start = time.monotonic()
        result = model.decode(window)
        results.append(
            {
                "audioEndSeconds": end / 16000,
                "inferenceSeconds": round(time.monotonic() - start, 3),
                "text": result.text,
                "speechEndMs": result.speech_end_ms,
            }
        )
    print(
        json.dumps(
            {
                "loadSeconds": round(load_seconds, 3),
                "audioSeconds": len(samples) / rate,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
