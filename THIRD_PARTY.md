# Third-party components

GPL-3.0-only covers Autoprompter's original code. Dependencies and model weights retain upstream licenses. This source release contains manifests and lockfiles, not installed packages or weights.

| Component | Role | Upstream information |
| --- | --- | --- |
| Parakeet TDT 0.6B v3 | Speech model | [NVIDIA model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) |
| MLX conversion | Downloaded weights | [MLX community model card](https://huggingface.co/mlx-community/parakeet-tdt-0.6b-v3) |
| parakeet-mlx | Recognition runtime | [Repository and license](https://github.com/senstella/parakeet-mlx) |
| MLX | Apple Silicon computation | [Repository and license](https://github.com/ml-explore/mlx) |
| Marked | Markdown parser | [Repository and license](https://github.com/markedjs/marked) |
| DOMPurify | HTML sanitizer | [Repository and license](https://github.com/cure53/DOMPurify) |
| FastAPI / Uvicorn | HTTP and WebSocket service | [FastAPI](https://github.com/fastapi/fastapi), [Uvicorn](https://github.com/encode/uvicorn) |
| NumPy / Hugging Face Hub | Arrays and model downloads | [NumPy](https://github.com/numpy/numpy), [Hub client](https://github.com/huggingface/huggingface_hub) |

Exact versions, including transitive/development packages, are in `uv.lock` and `web/package-lock.json`. Consult the license files shipped with those versions before redistributing dependencies, generated bundles, or weights. GitHub-generated source archives are the intended release artifact; a bundled binary distribution needs a separate notices review.
