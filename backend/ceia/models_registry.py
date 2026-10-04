"""The language models the engine depends on: which ones, which exact revision, and whether to insist on them.

Two transformer models score the news:

* **FinBERT** (``ProsusAI/finbert``) is the primary sentiment signal. It drives incident
  detection and the abnormal-return agreement check.
* **GoEmotions** (``SamLowe/roberta-base-go_emotions``) adds a secondary emotion tag.

Both are pinned to a commit hash so a fresh machine gets the same weights as the one the
engine was validated on, instead of whatever the Hub's ``main`` happens to be that day.

Policy (``ARTHDEX_ML`` environment variable)
--------------------------------------------
``auto`` (default)
    If ``torch`` and ``transformers`` are installed, the models are **required**: a model that
    cannot be loaded stops the run with a clear message. The engine never silently falls back
    to the word-list scorer on a machine that is supposed to have the models. If the packages
    are not installed (the light install), the word-list scorer is used and the log says so.
``required``
    Always insist on the models, even if the packages are missing.
``off``
    Never use the models. The word-list scorer is used deliberately.

Fetching the weights
--------------------
``python scripts/download_models.py`` downloads and verifies both (about 1 GB, once). If it was
never run, the data service downloads them before the first run that needs them. Once cached,
loading is fully offline.
"""

from __future__ import annotations

import importlib.util
import logging
import os
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class ModelUnavailable(RuntimeError):
    """A required language model is missing or cannot be loaded."""


@dataclass(frozen=True)
class ModelSpec:
    key: str
    repo: str
    revision: str
    purpose: str
    approx_mb: int


FINBERT = ModelSpec(
    key="finbert",
    repo="ProsusAI/finbert",
    revision="4556d13015211d73dccd3fdd39d39232506f3e43",
    purpose="Headline and article sentiment (primary signal)",
    approx_mb=440,
)
GOEMOTIONS = ModelSpec(
    key="goemotions",
    repo="SamLowe/roberta-base-go_emotions",
    revision="d75048347613a25d77de8cf6412eaae9fa7b26be",
    purpose="Headline emotion tags (secondary)",
    approx_mb=500,
)
MODELS: tuple[ModelSpec, ...] = (FINBERT, GOEMOTIONS)

# Alternative formats that would otherwise double the download.
_IGNORE_ALWAYS = ["*.h5", "*.msgpack", "*.ot", "*.onnx", "onnx/*", "*.tflite", "*.mlmodel", "*.mlpackage/*", "flax_*", "tf_*", "rust_*"]


# ---------------------------------------------------------------------------- policy


def ml_installed() -> bool:
    """True when both ``torch`` and ``transformers`` can be imported."""
    return all(importlib.util.find_spec(name) is not None for name in ("torch", "transformers"))


def mode() -> str:
    value = os.environ.get("ARTHDEX_ML", "auto").strip().lower()
    return value if value in ("auto", "required", "off") else "auto"


def disabled() -> bool:
    return mode() == "off"


def strict() -> bool:
    """Whether a missing or broken model must stop the run rather than degrade it."""
    current = mode()
    if current == "off":
        return False
    if current == "required":
        return True
    return ml_installed()


# ---------------------------------------------------------------------------- cache


def snapshot_dir(spec: ModelSpec) -> Path | None:
    """The local snapshot folder for this exact revision, if a usable copy is cached.

    The folder is located directly rather than through ``snapshot_download(local_files_only=True)``,
    because that call insists on every file in the repository (including the TensorFlow and Flax
    copies this project deliberately skips) and reports a complete PyTorch copy as incomplete.
    """
    try:
        from huggingface_hub import constants
    except ImportError:
        return None
    path = Path(constants.HF_HUB_CACHE) / ("models--" + spec.repo.replace("/", "--")) / "snapshots" / spec.revision
    if not path.is_dir():
        return None
    has_weights = (path / "model.safetensors").exists() or (path / "pytorch_model.bin").exists()
    has_tokenizer = any((path / name).exists() for name in ("tokenizer.json", "vocab.txt", "vocab.json"))
    return path if (path / "config.json").exists() and has_weights and has_tokenizer else None


def is_cached(spec: ModelSpec) -> bool:
    return snapshot_dir(spec) is not None


def load_kwargs(spec: ModelSpec) -> dict[str, Any]:
    """Arguments for ``from_pretrained``: the pinned revision, and no network when it is cached."""
    return {"revision": spec.revision, "local_files_only": is_cached(spec)}


def spec_for(repo: str) -> ModelSpec | None:
    return next((m for m in MODELS if m.repo == repo), None)


def kwargs_for(repo: str) -> dict[str, Any]:
    """Like :func:`load_kwargs` but tolerant of a custom model name (no pin, no offline)."""
    spec = spec_for(repo)
    return load_kwargs(spec) if spec else {}


# ---------------------------------------------------------------------------- download


def download(spec: ModelSpec, log_fn: Callable[[str], None] | None = None) -> Path:
    """Fetch one model at its pinned revision. Raises :class:`ModelUnavailable` on failure."""
    say = log_fn or log.info
    try:
        from huggingface_hub import HfApi, snapshot_download
    except ImportError as exc:
        raise ModelUnavailable(f"Language model unavailable: huggingface_hub is not installed ({exc}).") from exc

    ignore = list(_IGNORE_ALWAYS)
    try:
        files = {s.rfilename for s in HfApi().model_info(spec.repo, revision=spec.revision).siblings or []}
        if "model.safetensors" in files:
            ignore += ["*.bin", "*.pt", "*.pth"]
    except Exception as exc:  # listing is an optimisation only
        say(f"could not list files for {spec.repo}: {exc}")

    say(f"downloading {spec.repo}@{spec.revision[:8]} (about {spec.approx_mb} MB)")
    try:
        path = Path(snapshot_download(spec.repo, revision=spec.revision, ignore_patterns=ignore))
    except Exception as exc:
        raise ModelUnavailable(
            f"Language model unavailable: could not download {spec.repo} ({type(exc).__name__}: {exc}). "
            "Check the internet connection and free disk space (about 1 GB), then run "
            "`python scripts/download_models.py` from the backend folder."
        ) from exc
    if not is_cached(spec):
        raise ModelUnavailable(f"Language model unavailable: {spec.repo} downloaded incompletely. Re-run `python scripts/download_models.py`.")
    return path


def ensure_cached(log_fn: Callable[[str], None] | None = None) -> list[str]:
    """Make sure every model is on disk. Returns the keys that had to be downloaded."""
    fetched: list[str] = []
    for spec in MODELS:
        if not is_cached(spec):
            download(spec, log_fn)
            fetched.append(spec.key)
    return fetched


def unavailable(spec: ModelSpec, exc: BaseException) -> ModelUnavailable:
    return ModelUnavailable(
        f"Language model unavailable: {spec.repo} could not be loaded ({type(exc).__name__}: {exc}). "
        "Run `python scripts/download_models.py` from the backend folder, or set ARTHDEX_ML=off to use "
        "the word-list scorer on purpose."
    )


# ---------------------------------------------------------------------------- status


def status() -> dict[str, Any]:
    """Cheap, side-effect-free description for the API and the start-up log."""
    installed = ml_installed()
    models = [
        {
            "key": m.key,
            "repo": m.repo,
            "revision": m.revision,
            "purpose": m.purpose,
            "approxMb": m.approx_mb,
            "cached": is_cached(m),
        }
        for m in MODELS
    ]
    if disabled():
        engine = "word-list scorer (ARTHDEX_ML=off)"
    elif installed and all(m["cached"] for m in models):
        engine = "FinBERT + GoEmotions (ready)"
    elif strict():
        engine = "FinBERT + GoEmotions (will be downloaded before the next run)"
    else:
        engine = "word-list scorer (torch / transformers not installed)"
    return {"mode": mode(), "packagesInstalled": installed, "required": strict(), "engine": engine, "models": models}
