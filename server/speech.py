from pathlib import Path
from dataclasses import dataclass
import time
import numpy as np

MODEL = "mlx-community/parakeet-tdt-0.6b-v3"
CACHE = Path(__file__).resolve().parents[1] / ".runtime" / "models"


@dataclass
class Recognition:
    text: str
    speech_end_ms: float


def recognition_from_results(results):
    if not results:
        return Recognition("", 0)
    result = results[0]
    return Recognition(
        result.text,
        max((sentence.end for sentence in result.sentences), default=0) * 1000,
    )


class ParakeetRecognizer:
    def __init__(self, report=lambda status, detail: None):
        self.model = None
        self.report = report

    def load(self):
        if self.model is not None:
            return
        from huggingface_hub import hf_hub_download
        from tqdm.auto import tqdm
        from parakeet_mlx import from_pretrained

        report = self.report

        class Progress(tqdm):
            last = 0

            def update(self, n=1):
                value = super().update(n)
                if time.monotonic() - self.last > 0.5:
                    self.last = time.monotonic()
                    total = f" / {self.total / 1e6:.0f} MB" if self.total else ""
                    report(
                        "loading",
                        f"Downloading speech model: {self.n / 1e6:.0f} MB{total}",
                    )
                return value

        CACHE.mkdir(parents=True, exist_ok=True)
        files = []
        for filename in ("config.json", "model.safetensors"):
            try:
                path = hf_hub_download(
                    MODEL, filename, cache_dir=str(CACHE), local_files_only=True
                )
            except Exception:
                report("loading", "Downloading speech model for first use…")
                path = hf_hub_download(
                    MODEL, filename, cache_dir=str(CACHE), tqdm_class=Progress
                )
            files.append(Path(path))
        report("loading", "Loading model into memory…")
        self.model = from_pretrained(str(files[0].parent))
        self.decode(np.zeros(16000, dtype=np.float32))
        report("ready", "Romanian speech model ready. Audio stays on this Mac.")

    def decode(self, samples: np.ndarray) -> Recognition:
        import mlx.core as mx
        from parakeet_mlx.audio import get_logmel

        if self.model is None:
            raise RuntimeError("Model not loaded")
        mel = get_logmel(mx.array(samples), self.model.preprocessor_config)
        results = self.model.generate(mel)
        return recognition_from_results(results)

    def reset(self):
        pass  # independent overlapping windows carry no decoder state

    def close(self):
        self.model = None
