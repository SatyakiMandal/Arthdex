"""Download and verify the language models the event-impact engine needs.

Run once after installing the Python requirements (from the ``backend`` folder)::

    python scripts/download_models.py            # download anything missing, then verify
    python scripts/download_models.py --check    # verify only, never download (exit 1 if not ready)
    python scripts/download_models.py --force    # re-download even if cached

What it does
------------
1. Downloads FinBERT (about 440 MB) and GoEmotions (about 500 MB) at the exact revisions pinned in
   ``ceia/models_registry.py`` into the Hugging Face cache (``%USERPROFILE%\\.cache\\huggingface``;
   change it with the ``HF_HOME`` environment variable).
2. Loads each model fully offline and runs a sanity inference, so a corrupt or incomplete download
   is caught here rather than in the middle of a 15-minute analysis.

Exit status is 0 only when both models load and behave as expected.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from ceia import models_registry as ml  # noqa: E402


def say(text: str = "") -> None:
    print(text, flush=True)


def folder_size_mb(path: Path) -> float:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) / 1e6


def verify_finbert() -> str:
    from ceia.sentiment import FinBertScorer

    scorer = FinBertScorer()
    texts = [
        "Company beat profit expectations but missed guidance on margins, shares tumble",
        "Record quarterly profit and a large new order win lift the stock",
        "The board meeting is scheduled for next Tuesday",
    ]
    result = scorer._classify(texts)  # noqa: SLF001 - deliberately exercises the model path
    labels = [r.label for r in result]
    if scorer._model is None:  # noqa: SLF001
        raise ml.ModelUnavailable("Language model unavailable: FinBERT did not load.")
    if labels[0] != "negative" or labels[1] != "positive":
        raise ml.ModelUnavailable(
            f"Language model unavailable: FinBERT produced unexpected labels {labels} for the sanity sentences."
        )
    return ", ".join(f"{r.label} ({r.confidence:.2f})" for r in result)


def verify_goemotions() -> str:
    from ceia.emotion import GoEmotionScorer

    scorer = GoEmotionScorer()
    scores = scorer._classify(["Shares surge after record profit"])[0]  # noqa: SLF001
    if len(scores) != 28:
        raise ml.ModelUnavailable(
            f"Language model unavailable: GoEmotions returned {len(scores)} labels, expected 28."
        )
    top = sorted(scores, key=scores.get, reverse=True)[:3]
    return "top labels: " + ", ".join(f"{k} ({scores[k]:.2f})" for k in top)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="verify only; never download")
    parser.add_argument("--force", action="store_true", help="re-download even if already cached")
    args = parser.parse_args()

    if not ml.ml_installed():
        say("torch and transformers are not installed, so the language models cannot be used.")
        say("Install the full requirements first:  python -m pip install -r requirements.txt")
        return 2

    say(f"Hugging Face cache : {os.environ.get('HF_HOME') or '~/.cache/huggingface (default)'}")
    say(f"Policy (ARTHDEX_ML): {ml.mode()}")
    say()

    for spec in ml.MODELS:
        cached = ml.is_cached(spec)
        say(f"{spec.key:<11} {spec.repo}@{spec.revision[:8]}  {'cached' if cached else 'not cached'}")
        if args.check:
            continue
        if args.force or not cached:
            started = time.time()
            try:
                if args.force:
                    from huggingface_hub import snapshot_download

                    snapshot_download(spec.repo, revision=spec.revision, force_download=True,
                                      ignore_patterns=ml._IGNORE_ALWAYS)  # noqa: SLF001
                else:
                    ml.download(spec, say)
            except ml.ModelUnavailable as exc:
                say(f"  FAILED: {exc}")
                return 1
            say(f"  downloaded in {time.time() - started:.0f}s")

    say()
    failures = 0
    for spec, check in ((ml.FINBERT, verify_finbert), (ml.GOEMOTIONS, verify_goemotions)):
        if not ml.is_cached(spec):
            say(f"{spec.key:<11} NOT READY: not in the local cache")
            failures += 1
            continue
        path = ml.snapshot_dir(spec)
        try:
            detail = check()
        except Exception as exc:  # noqa: BLE001
            say(f"{spec.key:<11} FAILED verification: {exc}")
            failures += 1
            continue
        say(f"{spec.key:<11} OK  {folder_size_mb(path):.0f} MB on disk  ->  {detail}")

    say()
    if failures:
        say("Language models are NOT ready. Fix the errors above and run this script again.")
        return 1
    say("Both models are installed and verified. Analyses will use FinBERT and GoEmotions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
