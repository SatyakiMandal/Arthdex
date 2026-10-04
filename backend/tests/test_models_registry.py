"""Tests for the language-model policy: when the engine insists on FinBERT/GoEmotions and when it may fall back.

Run from ``backend/``:  python -m unittest discover -s tests -v
No network and no model weights are needed; the cache and the packages are simulated.
"""

from __future__ import annotations

import os
import unittest
from unittest import mock

from ceia import models_registry as ml
from ceia import sentiment


class Policy(unittest.TestCase):
    def setUp(self):
        self._env = mock.patch.dict(os.environ, {}, clear=False)
        self._env.start()
        os.environ.pop("ARTHDEX_ML", None)

    def tearDown(self):
        self._env.stop()

    def test_auto_is_strict_only_when_packages_are_installed(self):
        with mock.patch.object(ml, "ml_installed", return_value=True):
            self.assertTrue(ml.strict())
        with mock.patch.object(ml, "ml_installed", return_value=False):
            self.assertFalse(ml.strict())

    def test_required_and_off_override_installation(self):
        os.environ["ARTHDEX_ML"] = "required"
        with mock.patch.object(ml, "ml_installed", return_value=False):
            self.assertTrue(ml.strict())
        os.environ["ARTHDEX_ML"] = "off"
        with mock.patch.object(ml, "ml_installed", return_value=True):
            self.assertFalse(ml.strict())
            self.assertTrue(ml.disabled())

    def test_unknown_mode_falls_back_to_auto(self):
        os.environ["ARTHDEX_ML"] = "banana"
        self.assertEqual(ml.mode(), "auto")


class Pinning(unittest.TestCase):
    def test_every_model_is_pinned_to_a_full_commit_hash(self):
        for spec in ml.MODELS:
            self.assertRegex(spec.revision, r"^[0-9a-f]{40}$", spec.repo)

    def test_cached_models_load_offline_and_uncached_ones_may_download(self):
        with mock.patch.object(ml, "is_cached", return_value=True):
            self.assertEqual(ml.kwargs_for(ml.FINBERT.repo), {"revision": ml.FINBERT.revision, "local_files_only": True})
        with mock.patch.object(ml, "is_cached", return_value=False):
            self.assertFalse(ml.kwargs_for(ml.FINBERT.repo)["local_files_only"])

    def test_a_custom_model_name_is_not_pinned(self):
        self.assertEqual(ml.kwargs_for("someone/else-model"), {})


class NoSilentFallback(unittest.TestCase):
    """A machine that is supposed to have the models must not quietly score with the word list."""

    def test_load_failure_raises_when_strict(self):
        scorer = sentiment.FinBertScorer()
        with mock.patch.object(ml, "strict", return_value=True), \
             mock.patch.object(sentiment, "strict", return_value=True), \
             mock.patch.object(sentiment, "disabled", return_value=False), \
             mock.patch("transformers.AutoTokenizer.from_pretrained", side_effect=OSError("offline")):
            with self.assertRaises(ml.ModelUnavailable) as caught:
                scorer._classify(["profit up"])
        self.assertIn("Language model unavailable", str(caught.exception))
        self.assertIn("download_models.py", str(caught.exception))

    def test_load_failure_falls_back_when_not_strict(self):
        scorer = sentiment.FinBertScorer()
        with mock.patch.object(sentiment, "strict", return_value=False), \
             mock.patch.object(sentiment, "disabled", return_value=False), \
             mock.patch("transformers.AutoTokenizer.from_pretrained", side_effect=OSError("offline")):
            result = scorer._classify(["profit growth and a dividend"])
        self.assertEqual(result[0].label, "positive")  # the word-list scorer, used knowingly

    def test_off_uses_the_word_list_without_touching_the_models(self):
        scorer = sentiment.FinBertScorer()
        with mock.patch.object(sentiment, "disabled", return_value=True), \
             mock.patch("transformers.AutoTokenizer.from_pretrained", side_effect=AssertionError("must not load")):
            result = scorer._classify(["fraud probe and a penalty"])
        self.assertEqual(result[0].label, "negative")


class ServiceWiring(unittest.TestCase):
    def test_the_service_modules_import_and_expose_the_models_route(self):
        from app.main import app
        from app.services import analyzer

        self.assertTrue(callable(analyzer._preflight_models))  # noqa: SLF001
        self.assertIn("/api/v1/analyzer/models", app.openapi()["paths"])

    def test_preflight_does_nothing_when_models_are_not_required(self):
        from app.services import analyzer

        with mock.patch.object(ml, "strict", return_value=False):
            self.assertIsNone(analyzer._preflight_models("run", mock.Mock()))  # noqa: SLF001


class Status(unittest.TestCase):
    def test_status_shape(self):
        info = ml.status()
        self.assertEqual({m["key"] for m in info["models"]}, {"finbert", "goemotions"})
        self.assertIn(info["mode"], ("auto", "required", "off"))
        self.assertIsInstance(info["engine"], str)


if __name__ == "__main__":
    unittest.main()
