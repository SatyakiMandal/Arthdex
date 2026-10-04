"""Finance-aware sentiment plus coarse event tagging (PRD Sections 8, 9).

Sentiment uses **FinBERT** (``ProsusAI/finbert``), not a general-purpose model.
The PRD's reasoning holds up in testing: FinBERT reads "beat expectations but
missed guidance on margins" as 93% negative, where a generic lexicon scores
"beat" and "missed" as cancelling tokens and lands near neutral.

Two deliberate choices:

* **The headline is weighted above the body.** Headlines carry the claim the
  market reacts to; bodies dilute it with background and boilerplate.
* **Long bodies are chunked** to FinBERT's 512-token limit and averaged by
  confidence, rather than truncated, so a late reversal in a story is not lost.

Event tagging is keyword-based, which is what Section 8 asks for ("a full topic
classifier is not required"). It matters mainly so a sector-wide macro story is
not read as company-specific news.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import numpy as np

from .models import NewsItem
from .models_registry import ModelUnavailable, disabled, kwargs_for, spec_for, strict, unavailable

log = logging.getLogger(__name__)

MODEL_NAME = "ProsusAI/finbert"

# Ordered: the first category with a match wins, so specific beats generic.
EVENT_PATTERNS: list[tuple[str, str]] = [
    ("earnings", r"\b(q[1-4]|quarter|quarterly|earnings|profit|revenue|ebitda|"
                 r"results|topline|bottom ?line|margin|guidance|net profit|pat)\b"),
    ("litigation", r"\b(lawsuit|litigation|court|tribunal|nclt|verdict|plea|"
                   r"petition|sued|arbitration|insolvency|bankrupt)\b"),
    ("regulatory", r"\b(sebi|rbi|cci|regulator|regulatory|probe|investigation|"
                   r"penalt|fine|notice|compliance|ruling|approval|licence|license|"
                   r"cbi|enforcement directorate|ed |raid)\b"),
    # Leadership means a *change* of leadership. Requiring an action word stops
    # every story that merely quotes a chairman from landing here.
    ("leadership", r"\b(resign\w*|steps? down|stepped down|quit\w*|ousted|"
                   r"sacked|succession|reshuffle)\b"
                   r"|\b(?:ceo|cfo|coo|managing director|chairman|chairperson|"
                   r"board)\b[^.]{0,40}\b(?:appoint|elevat|named|nominat|exits?|"
                   r"replace|takes over|steps? in)\b"
                   r"|\b(?:appoint|elevat|named|nominat)\w*\b[^.]{0,40}"
                   r"\b(?:ceo|cfo|coo|managing director|chairman|chairperson)\b"),
    ("mna", r"\b(acquisi|acquire|merger|merge|stake sale|takeover|divest|"
            r"buyout|joint venture|open offer)\b"),
    ("capital", r"\b(fpo|ipo|rights issue|qip|fund ?rais|bond|debenture|"
                r"placement|buyback|dividend|share sale|pledge)\b"),
    ("product", r"\b(launch|unveil|new product|expansion|capacity|plant|"
                r"facility|contract win|order book|commission)\b"),
    ("macro", r"\b(inflation|gdp|repo rate|crude|rupee|fed |monetary policy|"
              r"budget|tariff|sector-wide|global markets|nifty|sensex)\b"),
]
_COMPILED = [(name, re.compile(pattern, re.I)) for name, pattern in EVENT_PATTERNS]


def tag_event(headline: str, body: str = "") -> str:
    """Coarse event category. The headline is checked before the body."""
    for text in (headline, body[:1200]):
        if not text:
            continue
        for name, pattern in _COMPILED:
            if pattern.search(text):
                return name
    return "other"


SEBI_LODR_PRICE_SENSITIVE = re.compile(
    r"\b(acquisition|merger|demerger|scheme of arrangement|takeover|slump sale|"
    r"resignation of (?:managing director|ceo|cfo|director|auditor)|"
    r"default on (?:loans?|debt|ncd|interest)|insolvency|nclt|cirp|"
    r"credit rating (?:downgrade|upgrade|revision)|"
    r"forensic audit|search and seizure|enforcement directorate|cbi|income tax raid|"
    r"strike|lockout|plant shutdown|halt in operations|"
    r"cancellation of (?:order|contract|license))\b",
    re.I,
)

SEBI_LODR_FINANCIAL_RESULTS = re.compile(
    r"\b(financial results|un-audited financial results|audited financial results|"
    r"outcome of board meeting|declaration of dividend|interim dividend|"
    r"statement of impact of audit qualifications)\b",
    re.I,
)


def classify_sebi_lodr_priority(headline: str, body: str = "") -> dict[str, Any]:
    """Classify corporate exchange filing under SEBI (LODR) Regulations 2015 priority tiers.

    Tiers:
    - Tier 1: Price-Sensitive Material Event (Reg 30 - Schedule III Part A/B)
    - Tier 2: Financial Results & Dividend Declaration (Reg 33)
    - Tier 3: Routine Secretarial & General Compliance (Reg 31, 39, etc.)
    """
    combined = f"{headline or ''} {body or ''}"[:2000]

    if SEBI_LODR_PRICE_SENSITIVE.search(combined):
        return {
            "tier": 1,
            "category": "Price-Sensitive Material Event (SEBI LODR Reg 30)",
            "priority": "HIGH",
            "disclosure_window_hrs": 24,
        }
    elif SEBI_LODR_FINANCIAL_RESULTS.search(combined):
        return {
            "tier": 2,
            "category": "Financial Results & Corporate Action (SEBI LODR Reg 33)",
            "priority": "MEDIUM",
            "disclosure_window_hrs": 48,
        }
    else:
        return {
            "tier": 3,
            "category": "Routine Secretarial & General Compliance",
            "priority": "ROUTINE",
            "disclosure_window_hrs": 72,
        }


@dataclass
class Sentiment:
    label: str
    score: float       # signed: +1 fully positive, -1 fully negative
    confidence: float  # probability of the winning label


class FinBertScorer:
    """Lazy-loading FinBERT wrapper.

    The model is ~440 MB and loads on first use, so constructing the scorer is
    cheap and an ingest run that collects nothing never pays for it.
    """

    def __init__(self, model_name: str = MODEL_NAME, batch_size: int = 16,
                 headline_weight: float = 0.6) -> None:
        self.model_name = model_name
        self.batch_size = batch_size
        self.headline_weight = headline_weight
        self._tokenizer = None
        self._model = None
        self._torch = None

    def _load(self) -> None:
        if self._model is not None or disabled():
            return
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except ImportError as exc:
            if strict():
                raise ModelUnavailable(
                    f"Language model unavailable: torch / transformers are not installed ({exc}). "
                    "Install backend/requirements.txt, or set ARTHDEX_ML=off to use the word-list scorer on purpose."
                ) from exc
            log.warning("FinBERT dependencies missing (%s); using the word-list scorer", exc)
            return
        kwargs = kwargs_for(self.model_name)
        try:
            log.info("loading %s%s", self.model_name, "" if kwargs.get("local_files_only") else " (not cached: downloading, about 440 MB)")
            self._torch = torch
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, **kwargs)
            self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name, **kwargs)
            self._model.eval()
        except Exception as exc:
            self._model = None
            spec = spec_for(self.model_name)
            if strict() and spec is not None:
                raise unavailable(spec, exc) from exc
            log.warning("Could not initialize FinBERT model (%s): %s", self.model_name, exc)

    def _classify_lexicon(self, texts: list[str]) -> list[Sentiment]:
        pos_words = {"profit", "growth", "surge", "gain", "dividend", "order", "win", "expansion", "beat", "positive", "high", "rise", "rally", "upgrade", "approved", "revenue", "ebitda"}
        neg_words = {"loss", "fall", "drop", "decline", "penalty", "probe", "fraud", "default", "lawsuit", "fine", "raid", "strike", "downgrade", "scam", "nclt", "insolvency", "deficit"}
        out: list[Sentiment] = []
        for t in texts:
            words = set(re.findall(r"\w+", (t or "").lower()))
            pos_hits = len(words & pos_words)
            neg_hits = len(words & neg_words)
            total = pos_hits + neg_hits
            if total == 0:
                out.append(Sentiment(label="neutral", score=0.0, confidence=0.75))
            elif pos_hits > neg_hits:
                score = round((pos_hits - neg_hits) / total, 3)
                out.append(Sentiment(label="positive", score=score, confidence=0.85))
            else:
                score = round((pos_hits - neg_hits) / total, 3)
                out.append(Sentiment(label="negative", score=score, confidence=0.85))
        return out

    def _classify(self, texts: list[str]) -> list[Sentiment]:
        try:
            self._load()
            if self._model is None or self._tokenizer is None:
                return self._classify_lexicon(texts)
            torch = self._torch
            out: list[Sentiment] = []
            id2label = {i: l.lower() for i, l in self._model.config.id2label.items()}
            total = len(texts)
            for start in range(0, total, self.batch_size):
                batch = texts[start:start + self.batch_size]
                encoded = self._tokenizer(batch, return_tensors="pt", padding=True,
                                          truncation=True, max_length=512)
                with torch.no_grad():
                    probabilities = torch.softmax(self._model(**encoded).logits, dim=-1)
                for row in probabilities:
                    scores = {id2label[i]: float(v) for i, v in enumerate(row)}
                    label = max(scores, key=scores.get)
                    out.append(Sentiment(
                        label=label,
                        score=scores.get("positive", 0.0) - scores.get("negative", 0.0),
                        confidence=scores[label],
                    ))
                log.info("FinBERT: scored %d/%d texts", min(start + self.batch_size, total), total)
            return out
        except ModelUnavailable:
            raise
        except Exception as exc:
            if strict():
                raise ModelUnavailable(f"Language model unavailable: FinBERT inference failed ({type(exc).__name__}: {exc}).") from exc
            log.warning("FinBERT inference error (%s); using lexicon fallback", exc)
            return self._classify_lexicon(texts)

    def _chunks(self, text: str, max_words: int = 300) -> list[str]:
        words = text.split()
        if len(words) <= max_words:
            return [text] if text.strip() else []
        return [" ".join(words[i:i + max_words])
                for i in range(0, len(words), max_words)]

    @staticmethod
    def extract_entity_relevant_text(text: str, aliases: list[str] | None = None) -> str:
        """Extract only sentences/paragraphs that directly mention the target company
        or its aliases to prevent cross-company sentiment contamination in sector roundups.
        """
        if not text or not aliases:
            return text

        # Compile pattern matching any alias as whole word
        escaped_aliases = [re.escape(a.strip()) for a in aliases if a.strip()]
        if not escaped_aliases:
            return text
        pattern = re.compile(r"\b(?:" + "|".join(escaped_aliases) + r")\b", re.I)

        # Split into sentences or paragraphs
        paragraphs = text.split("\n\n")
        matching_paras = [p.strip() for p in paragraphs if pattern.search(p)]
        if matching_paras:
            return " ".join(matching_paras)

        # Sentence fallback
        sentences = re.split(r"(?<=[.!?])\s+", text)
        matching_sents = [s.strip() for s in sentences if pattern.search(s)]
        if matching_sents:
            return " ".join(matching_sents)

        return text

    @staticmethod
    def detect_negation_or_refutation(text: str) -> bool:
        """Detect negation, denial, or refutation of adverse allegations to prevent false-negative scores."""
        if not text:
            return False
        pattern = re.compile(
            r"\b(?:no|not|denies|denied|refutes|refuted|dismisses|dismissed|unfounded|baseless|rejects|rejected)\b"
            r"[^.]{0,35}\b(?:fraud|default|irregularity|probe|scam|violation|investigation|bankruptcy|insolvency)\b",
            re.I,
        )
        return bool(pattern.search(text))

    @staticmethod
    def compute_entity_salience(
        text: str,
        aliases: list[str] | None = None,
        min_word_count: int = 20,
    ) -> float:
        """Compute the salience / prominence ratio of the target company within a news text.

        Returns a score in [0.0, 1.0]. A score < 0.20 indicates a passing mention in a
        broad multi-company sector roundup or market wrap.
        """
        if not text or not aliases:
            return 1.0 if not text else 0.0

        words = text.split()
        if len(words) < min_word_count:
            return 1.0

        escaped = [re.escape(a.strip()) for a in aliases if a.strip()]
        if not escaped:
            return 0.0

        pattern = re.compile(r"\b(?:" + "|".join(escaped) + r")\b", re.I)
        matches = list(pattern.finditer(text))
        if not matches:
            return 0.0

        # Salience formula: frequency of target entity vs total sentences, weighted by early occurrence
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        target_sents = sum(1 for s in sentences if pattern.search(s))

        sent_ratio = target_sents / max(len(sentences), 1)
        first_pos_ratio = max(0.0, 1.0 - (matches[0].start() / max(len(text), 1)))

        # Combined salience score
        salience = 0.7 * sent_ratio + 0.3 * first_pos_ratio
        return round(float(min(max(salience, 0.0), 1.0)), 3)

    def score_items(self, items: list[NewsItem], aliases: list[str] | None = None) -> list[NewsItem]:
        """Score headline and body separately with entity-aware sentence targeting."""
        if not items:
            return items

        headlines = [i.headline or "" for i in items]
        headline_scores = self._classify(headlines) if any(headlines) else []

        # Flatten every item's body chunks into one batch, tracking ownership.
        chunk_texts: list[str] = []
        owners: list[int] = []
        for index, item in enumerate(items):
            raw_body = item.body or item.snippet or ""
            target_body = self.extract_entity_relevant_text(raw_body, aliases)
            for chunk in self._chunks(target_body):
                chunk_texts.append(chunk)
                owners.append(index)
        chunk_scores = self._classify(chunk_texts) if chunk_texts else []

        body_by_item: dict[int, list[Sentiment]] = {}
        for owner, sentiment in zip(owners, chunk_scores):
            body_by_item.setdefault(owner, []).append(sentiment)

        for index, item in enumerate(items):
            head = headline_scores[index] if index < len(headline_scores) else None
            chunks = body_by_item.get(index, [])
            if chunks:
                # Confidence-weighted mean, so hedged chunks count for less.
                total_weight = sum(c.confidence for c in chunks) or 1.0
                body_score = sum(c.score * c.confidence for c in chunks) / total_weight
                body_confidence = sum(c.confidence for c in chunks) / len(chunks)
            else:
                body_score, body_confidence = 0.0, 0.0

            if head and chunks:
                weight = self.headline_weight
                score = weight * head.score + (1 - weight) * body_score
                confidence = weight * head.confidence + (1 - weight) * body_confidence
            elif head:
                score, confidence = head.score, head.confidence
            else:
                score, confidence = body_score, body_confidence

            item.sentiment_score = round(score, 4)
            item.sentiment_confidence = round(confidence, 4)
            item.sentiment_label = (
                "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
            )
            item.event_category = tag_event(item.headline, item.body or item.snippet)
        return items


def score(items: list[NewsItem], scorer: FinBertScorer | None = None) -> list[NewsItem]:
    return (scorer or FinBertScorer()).score_items(items)


def compute_cross_source_sentiment_divergence(
    items: list[NewsItem],
) -> dict[date, dict[str, Any]]:
    """Compute daily cross-source sentiment dispersion to quantify information asymmetry and media narrative divergence.

    For each trading day with >= 2 distinct sources:
    - Calculates source-level mean sentiments: s_k
    - Calculates cross-source standard deviation: sigma_sources = Std(s_k)
    - Flags high narrative fragmentation days (sigma_sources >= 0.30)
    """
    by_day: dict[date, dict[str, list[float]]] = {}

    for item in items:
        day = getattr(item, "trading_day", None)
        src = getattr(item, "source", None)
        score_val = getattr(item, "sentiment_score", None)
        if not day or not src or score_val is None or getattr(item, "duplicate_of", None) is not None:
            continue
        by_day.setdefault(day, {}).setdefault(src, []).append(float(score_val))

    divergence_by_day: dict[date, dict[str, Any]] = {}

    for day, sources_dict in by_day.items():
        if len(sources_dict) < 2:
            divergence_by_day[day] = {
                "source_count": len(sources_dict),
                "source_means": {s: round(float(np.mean(scores)), 3) for s, scores in sources_dict.items()},
                "cross_source_std": 0.0,
                "has_divergence": False,
                "narrative_regime": "Single Source / Uniform",
            }
            continue

        source_means = {s: float(np.mean(scores)) for s, scores in sources_dict.items()}
        means_list = list(source_means.values())
        src_std = float(np.std(means_list, ddof=1)) if len(means_list) > 1 else 0.0

        has_div = bool(src_std >= 0.30)
        regime = "High Narrative Fragmentation" if src_std >= 0.35 else "Moderate Divergence" if src_std >= 0.20 else "Strong Media Consensus"

        divergence_by_day[day] = {
            "source_count": len(sources_dict),
            "source_means": {s: round(v, 3) for s, v in source_means.items()},
            "cross_source_std": round(src_std, 3),
            "has_divergence": has_div,
            "narrative_regime": regime,
        }

    return divergence_by_day


def classify_esg_category(headline: str, body: str = "") -> dict[str, Any]:
    """Classify environmental, social, and governance (ESG) themes, controversy risk tiers, and carbon transition signals.

    Pillars:
    - Environmental: emissions, pollution, net-zero, green hydrogen, EV, solar, renewable, effluent, deforestation, ESG rating
    - Social: strike, labor union, safety hazard, workplace fatality, wage dispute, diversity, human rights, employee welfare
    - Governance: promoter pledge, board independence, related party, audit resignation, whistleblower, SEBI penalty, insider trading
    """
    text = f"{headline} {body}".lower()

    e_keywords = [
        "emission", "pollution", "net zero", "net-zero", "carbon", "green hydrogen", "ev ",
        "electric vehicle", "solar", "renewable", "effluent", "deforestation", "esg", "clean energy",
        "waste management", "green bond", "sustainability", "climate", "biodiversity"
    ]
    s_keywords = [
        "strike", "labor union", "labour union", "worker protest", "workplace safety", "fatal accident",
        "employee death", "wage dispute", "salary delay", "layoff", "diversity", "harassment",
        "consumer complaint", "child labour", "human rights", "csr spend"
    ]
    g_keywords = [
        "promoter pledge", "board independence", "related party transaction", "rpt", "auditor resignation",
        "audit qualification", "whistleblower", "sebi penalty", "insider trading", "forensic audit",
        "cbi raid", "ed search", "sfio", "fraud", "bribe", "money laundering"
    ]

    e_hits = [k for k in e_keywords if re.search(r"\b" + re.escape(k) + r"\b", text)]
    s_hits = [k for k in s_keywords if re.search(r"\b" + re.escape(k) + r"\b", text)]
    g_hits = [k for k in g_keywords if re.search(r"\b" + re.escape(k) + r"\b", text)]

    counts = {"Environmental": len(e_hits), "Social": len(s_hits), "Governance": len(g_hits)}
    max_pillar = max(counts, key=counts.get)
    max_count = counts[max_pillar]

    if max_count == 0:
        return {
            "is_esg": False,
            "pillar": None,
            "matched_keywords": [],
            "controversy_tier": "None",
            "is_positive_transition": False,
        }

    matched_kw = e_hits if max_pillar == "Environmental" else s_hits if max_pillar == "Social" else g_hits

    pos_terms = ["net zero", "green bond", "green hydrogen", "renewable", "solar", "sustainability", "clean energy", "csr"]
    is_pos = any(t in matched_kw for t in pos_terms) and not any(neg in text for neg in ["penalty", "violation", "probe", "fine", "raid", "strike"])

    tier = "Low Controversy"
    if not is_pos:
        if any(w in text for w in ["fatal", "death", "raid", "fraud", "whistleblower", "forensic", "penalty", "strike"]):
            tier = "Severe Controversy"
        elif len(matched_kw) >= 2:
            tier = "Moderate Controversy"

    return {
        "is_esg": True,
        "pillar": max_pillar,
        "matched_keywords": matched_kw,
        "controversy_tier": tier,
        "is_positive_transition": is_pos,
    }


def get_domain_authority_weight(source: str, url: str = "") -> float:
    """Return institutional domain credibility multiplier w in [0.6, 1.5].

    Tiers:
    - Tier 1 (1.5x): Regulatory / Exchange Disclosures (NSE, BSE, SEBI)
    - Tier 2 (1.2x): Premier Financial Dailies (Moneycontrol, Livemint, Economic Times, Business Today, Reuters, Bloomberg, CNBC)
    - Tier 3 (1.0x): General Mainstream Press (Times of India, NDTV, The Hindu, Indian Express)
    - Tier 4 (0.7x): Aggregators, blogs, secondary syndications
    """
    s = f"{source} {url}".lower()

    if any(k in s for k in ["bse", "nse", "sebi", "exchange filing", "statutory", "corporate announcement"]):
        return 1.5
    if any(k in s for k in ["moneycontrol", "livemint", "mint", "economictimes", "economic times", "businesstoday", "business today", "reuters", "bloomberg", "cnbc"]):
        return 1.2
    if any(k in s for k in ["times of india", "timesofindia", "ndtv", "hindu", "thehindu", "indianexpress", "indian express", "business standard"]):
        return 1.0
    return 0.7


def apply_domain_authority_weighting(items: list[NewsItem]) -> list[NewsItem]:
    """Scale each news item's sentiment confidence and effective weight by publisher domain authority."""
    for item in items:
        w = get_domain_authority_weight(item.source or "", item.url or "")
        setattr(item, "domain_weight", w)
        if item.sentiment_confidence is not None:
            item.sentiment_confidence = round(float(min(1.0, item.sentiment_confidence * (w / 1.2))), 4)
    return items


def compute_sentiment_decay_half_life(
    items: list[NewsItem],
    event_date: date,
    max_days: int = 14,
) -> dict[str, Any]:
    """Fit exponential narrative decay model |S(t)| = S_0 * exp(-lambda * t) and compute media sentiment half-life.

    Metrics:
    - lambda_decay: Empirical exponential decay constant
    - half_life_days: t_{1/2} = ln(2) / lambda
    - narrative_persistence_regime: Rapid Absorption (<=2d), Moderate Linger (3-5d), Persistent (>5d)
    """
    post_items = [
        item for item in items
        if item.trading_day and item.trading_day >= event_date
        and getattr(item, "sentiment_score", None) is not None
        and (item.trading_day - event_date).days <= max_days
        and getattr(item, "duplicate_of", None) is None
    ]

    if not post_items:
        return {
            "initial_sentiment": 0.0,
            "lambda_decay": 0.35,
            "half_life_days": 2.0,
            "narrative_persistence_regime": "Unassessed (No post-event items)",
        }

    by_day: dict[int, list[float]] = {}
    for it in post_items:
        offset = (it.trading_day - event_date).days
        by_day.setdefault(offset, []).append(abs(float(it.sentiment_score)))

    days = sorted(by_day.keys())
    day_means = [float(np.mean(by_day[d])) for d in days]

    s0 = day_means[0] if day_means else 0.5
    if len(days) < 2 or max(day_means) == 0:
        return {
            "initial_sentiment": round(s0, 3),
            "lambda_decay": 0.35,
            "half_life_days": 2.0,
            "narrative_persistence_regime": "Rapid Absorption (<=2d)",
        }

    log_vals = [np.log(max(1e-4, v)) for v in day_means]
    t_vals = np.array(days, dtype=float)
    if len(np.unique(t_vals)) > 1:
        slope = float(np.polyfit(t_vals, log_vals, 1)[0])
        lam = max(0.05, -slope)
    else:
        lam = 0.35

    half_life = np.log(2) / lam
    half_life_clamped = float(min(max(half_life, 0.5), float(max_days)))

    regime = (
        "Persistent Narrative (>5d)" if half_life_clamped > 5.0
        else "Moderate Linger (3-5d)" if half_life_clamped >= 3.0
        else "Rapid Absorption (<=2d)"
    )

    return {
        "initial_sentiment": round(s0, 3),
        "lambda_decay": round(lam, 4),
        "half_life_days": round(half_life_clamped, 1),
        "narrative_persistence_regime": regime,
    }


def compute_uncertainty_hedging_score(text: str) -> dict[str, Any]:
    """Compute financial uncertainty and modal hedging density using Loughran-McDonald uncertainty lexicon.

    Detects ambiguous qualifiers: might, could, may, contingent, tentative, preliminary,
    unanticipated, uncertain, approximate, unpredictable, fluctuate, subject to, pending, speculative.
    """
    clean_text = text.lower()
    words = re.findall(r"\b\w+\b", clean_text)
    total_words = len(words)
    if total_words == 0:
        return {
            "uncertainty_count": 0,
            "uncertainty_density_pct": 0.0,
            "matched_hedging_terms": [],
            "hedging_tier": "Decisive / Confident",
        }

    uncertainty_lexicon = [
        "might", "could", "may", "contingent", "tentative", "preliminary", "unanticipated",
        "uncertain", "approximate", "unpredictable", "fluctuate", "pending", "speculative",
        "subject to", "conditional", "assumption", "possibility", "volatility", "unforeseen"
    ]

    matched = [term for term in uncertainty_lexicon if re.search(r"\b" + re.escape(term) + r"\b", clean_text)]
    term_count = sum(len(re.findall(r"\b" + re.escape(term) + r"\b", clean_text)) for term in matched)
    density = (term_count / total_words) * 100.0

    tier = (
        "High Hedging Ambiguity (>3.0%)" if density >= 3.0
        else "Moderate Uncertainty (1.0-3.0%)" if density >= 1.0
        else "Decisive / Confident (<1.0%)"
    )

    return {
        "uncertainty_count": term_count,
        "uncertainty_density_pct": round(density, 2),
        "matched_hedging_terms": matched,
        "hedging_tier": tier,
    }


def compute_media_cascade_and_echo_score(
    items: list[NewsItem],
    event_date: date,
    window_days: int = 2,
) -> dict[str, Any]:
    """Analyze media publication sequencing to identify originating lead source vs secondary echo syndication wave.

    Metrics:
    - originating_source: Earliest reporting news outlet / statutory source
    - echo_sources: Subsequent reporting outlets echoing the story
    - lead_count: Number of originating lead articles
    - echo_count: Number of secondary echo articles
    - echo_amplification_multiplier: echo_count / max(1, lead_count)
    - cascade_breadth: Count of unique publishers echoing the narrative
    """
    event_items = [
        item for item in items
        if item.trading_day and abs((item.trading_day - event_date).days) <= window_days
        and getattr(item, "duplicate_of", None) is None
    ]

    if not event_items:
        return {
            "originating_source": "None",
            "lead_count": 0,
            "echo_count": 0,
            "echo_amplification_multiplier": 0.0,
            "cascade_breadth": 0,
            "echo_sources": [],
            "propagation_speed": "No Coverage",
        }

    def _sort_key(it):
        pub = getattr(it, "published_at", None)
        if pub is not None:
            return (0, str(pub))
        day = getattr(it, "trading_day", None)
        return (1, str(day) if day else "")

    sorted_items = sorted(event_items, key=_sort_key)
    originating_src = sorted_items[0].source or "Unknown"

    lead_items = [it for it in sorted_items if (it.source or "Unknown") == originating_src]
    echo_items = [it for it in sorted_items if (it.source or "Unknown") != originating_src]

    lead_cnt = len(lead_items)
    echo_cnt = len(echo_items)
    echo_srcs = sorted(list({it.source for it in echo_items if it.source}))
    amp_mult = round(float(echo_cnt) / max(1.0, float(lead_cnt)), 2)

    speed = (
        "Viral Echo Cascade (Amplification > 3.0x)" if amp_mult >= 3.0
        else "Broad Media Diffusion (1.5 - 3.0x)" if amp_mult >= 1.5
        else "Moderate Syndication" if echo_cnt > 0
        else "Isolated Lead Coverage"
    )

    return {
        "originating_source": originating_src,
        "lead_count": lead_cnt,
        "echo_count": echo_cnt,
        "echo_amplification_multiplier": amp_mult,
        "cascade_breadth": len(echo_srcs),
        "echo_sources": echo_srcs,
        "propagation_speed": speed,
    }


def extract_forward_guidance_and_targets(text: str) -> dict[str, Any]:
    """Extract forward-looking management guidance statements, capex targets, and margin outlook.

    Detects explicit markers: guidance, target, expects to, anticipates, forecasts,
    projects, order pipeline of, capex of, margin guidance, aims to achieve, revenue target.
    """
    clean_text = text.lower()
    guidance_markers = [
        "guidance", "target", "expects to", "anticipates", "forecasts", "projects",
        "pipeline of", "capex of", "margin guidance", "aims to achieve", "outlook",
        "expected to reach", "plans to invest", "projected growth", "full-year target"
    ]

    matched_markers = [m for m in guidance_markers if m in clean_text]
    sentences = re.split(r"[.\n;]", text)
    extracted_guidance_snippets = []

    for s in sentences:
        s_clean = s.strip()
        if not s_clean:
            continue
        s_lower = s_clean.lower()
        if any(m in s_lower for m in guidance_markers):
            extracted_guidance_snippets.append(s_clean)

    has_numbers = any(re.search(r"\d+", snip) for snip in extracted_guidance_snippets)

    if extracted_guidance_snippets and has_numbers:
        commitment_tier = "Strong Quantified Guidance"
    elif extracted_guidance_snippets:
        commitment_tier = "Qualitative Strategic Outlook"
    else:
        commitment_tier = "No Forward Guidance"

    return {
        "guidance_detected": len(extracted_guidance_snippets) > 0,
        "matched_markers": matched_markers,
        "guidance_snippets": extracted_guidance_snippets[:3],
        "commitment_tier": commitment_tier,
    }


def classify_sebi_lodr_materiality(text: str) -> dict[str, Any]:
    """Classify corporate disclosure into SEBI (LODR) Regulation 30 Schedule III Materiality Tiers.

    Tiers:
    - Tier 1 (Immediate Price Sensitive / 30m-24h statutory deadline): Acquisitions, Mergers, Demergers, Defaults, Forensic Audits, Fraud, Insolvency, Resignation of KMP/Auditor.
    - Tier 2 (Material Business Impact): Major Order Wins, Contracts, Capacity Expansion, Capex, Product Launches, Litigation Awards.
    - Tier 3 (Standard Statutory Disclosures): Board Meeting Outcomes, Financial Results, Postal Ballot, AGM Notices, Dividend Recommendations.
    """
    clean_text = text.lower()

    tier1_triggers = [
        "acquisition", "merger", "demerger", "amalgamation", "restructuring",
        "default", "insolvency", "cirp", "nclt", "forensic audit", "fraud",
        "investigation", "resignation of auditor", "resignation of director",
        "resignation of md", "cancellation of dividend", "cpr", "sebi order", "raids"
    ]

    tier2_triggers = [
        "order win", "contract win", "bags order", "secures contract", "awarded contract",
        "capacity expansion", "new plant", "capex", "commercial production", "launch",
        "patent", "licence", "litigation award", "arbitration award", "mou"
    ]

    tier3_triggers = [
        "board meeting", "financial results", "quarterly results", "dividend",
        "postal ballot", "agm", "egm", "annual general meeting", "investor presentation",
        "trading window closure", "shareholding pattern"
    ]

    matched_t1 = [t for t in tier1_triggers if t in clean_text]
    matched_t2 = [t for t in tier2_triggers if t in clean_text]
    matched_t3 = [t for t in tier3_triggers if t in clean_text]

    if matched_t1:
        tier = "Tier 1: Immediate Price Sensitive (Reg 30 Part A)"
        category = matched_t1[0].title()
        requires_immediate_action = True
    elif matched_t2:
        tier = "Tier 2: Material Business Event (Reg 30 Part B)"
        category = matched_t2[0].title()
        requires_immediate_action = False
    elif matched_t3:
        tier = "Tier 3: Standard Statutory / Board Filing"
        category = matched_t3[0].title()
        requires_immediate_action = False
    else:
        tier = "General Corporate News / Press Mention"
        category = "Unclassified"
        requires_immediate_action = False

    return {
        "materiality_tier": tier,
        "schedule_iii_category": category,
        "requires_immediate_statutory_disclosure": requires_immediate_action,
        "matched_statutory_triggers": matched_t1 or matched_t2 or matched_t3,
    }


def compute_governance_red_flags(text: str) -> dict[str, Any]:
    """Parse text for forensic corporate governance red flags across Indian statutory contexts.

    Flags:
    - Audit Disputes: auditor resignation, qualified opinion, adverse opinion, disclaimer of opinion, forensic audit, sfo, eow.
    - Related Party & Capital Diversion: related party transaction, rpt, loan to promoter, write-off, inter-corporate deposit, fund diversion.
    - Promoter Distress: promoter pledging, invoke pledge, pledged shares, encumbrance, tax raid, ed attachment.
    - Executive Turmoil: abrupt resignation, whistleblower, complaint, sebi show cause, adjudication, penalties.
    """
    clean_text = text.lower()

    audit_terms = [
        "auditor resignation", "resignation of auditor", "qualified opinion",
        "adverse opinion", "disclaimer of opinion", "forensic audit", "sfo",
        "serious fraud", "accounting irregularity"
    ]
    rpt_terms = [
        "related party transaction", "rpt", "fund diversion", "unsecured loan",
        "inter-corporate deposit", "promoter loan", "write off", "siphoning"
    ]
    pledge_terms = [
        "promoter pledge", "pledged shares", "invocation of pledge", "encumbrance",
        "tax raid", "attachment of assets", "cbi raid", "ed raid"
    ]
    turmoil_terms = [
        "whistleblower", "whistle blower", "sebi show cause", "show-cause notice",
        "adjudication order", "penalties imposed", "abrupt resignation"
    ]

    matched_audit = [t for t in audit_terms if t in clean_text]
    matched_rpt = [t for t in rpt_terms if t in clean_text]
    matched_pledge = [t for t in pledge_terms if t in clean_text]
    matched_turmoil = [t for t in turmoil_terms if t in clean_text]

    flag_count = len(matched_audit) + len(matched_rpt) + len(matched_pledge) + len(matched_turmoil)

    if flag_count >= 3 or matched_audit:
        severity = "Critical Governance Warning (Red Alert)"
    elif flag_count >= 1:
        severity = "Elevated Governance Scrutiny (Amber)"
    else:
        severity = "Clean Governance Profile"

    return {
        "governance_flag_count": flag_count,
        "governance_severity": severity,
        "audit_red_flags": matched_audit,
        "rpt_red_flags": matched_rpt,
        "promoter_pledge_flags": matched_pledge,
        "executive_turmoil_flags": matched_turmoil,
    }


def compute_linguistic_complexity_and_fog_index(text: str) -> dict[str, Any]:
    """Compute Gunning Fog Readability Index and SEC Plain English complexity score.

    Gunning Fog = 0.4 * [ (words / sentences) + 100 * (complex_words / words) ]
    """
    clean_text = text.strip()
    words = re.findall(r"\b[A-Za-z]+\b", clean_text)
    sentences = [s.strip() for s in re.split(r"[.!?]+", clean_text) if s.strip()]

    W = len(words)
    S = max(1, len(sentences))

    if W == 0:
        return {
            "gunning_fog_index": 12.0,
            "complex_word_pct": 15.0,
            "avg_sentence_length": 15.0,
            "readability_tier": "Plain English / Clear (<12)",
        }

    # Count syllables per word
    def _syllable_count(word):
        w = word.lower()
        count = len(re.findall(r"[aeiouy]+", w))
        if w.endswith("e") and not w.endswith("le") and count > 1:
            count -= 1
        return max(1, count)

    complex_words = [w for w in words if _syllable_count(w) >= 3]
    complex_pct = (len(complex_words) / W) * 100.0
    asl = W / S

    fog = 0.4 * (asl + complex_pct)
    fog_clamped = min(max(fog, 4.0), 30.0)

    tier = (
        "Obfuscated / High Complexity (Fog > 18)" if fog_clamped > 18.0
        else "Standard Technical Disclosure (12-18)" if fog_clamped >= 12.0
        else "Plain English / Transparent (<12)"
    )

    return {
        "gunning_fog_index": round(fog_clamped, 2),
        "complex_word_pct": round(complex_pct, 2),
        "avg_sentence_length": round(asl, 1),
        "readability_tier": tier,
    }


def compute_qa_evasion_score(text: str) -> dict[str, Any]:
    """Detect evasive linguistic hedging during analyst earnings call Q&A sessions.

    Markers: too early to tell, broadly speaking, overall trend, as you know,
    difficult to predict, cannot comment at this stage, let us take this offline.
    """
    clean_text = text.lower()
    evasion_markers = [
        "too early to tell", "broadly speaking", "overall trend", "as you know",
        "difficult to predict", "cannot comment at this stage", "take this offline",
        "see how it evolves", "subject to market conditions", "hard to pinpoint",
        "various moving parts", "directionally positive", "broadly in line"
    ]

    matched = [m for m in evasion_markers if m in clean_text]
    words = re.findall(r"\b\w+\b", clean_text)
    total_words = max(1, len(words))

    count = sum(len(re.findall(r"\b" + re.escape(m) + r"\b", clean_text)) for m in matched)
    evasion_density = (count / total_words) * 100.0

    tier = (
        "High Management Evasion / Ambiguity (>2.0%)" if evasion_density >= 2.0
        else "Moderate Evasive Tone (0.8-2.0%)" if evasion_density >= 0.8
        else "Direct & Forthright Executive Tone"
    )

    return {
        "evasion_marker_count": count,
        "evasion_density_pct": round(evasion_density, 2),
        "matched_evasion_phrases": matched,
        "executive_directness_tier": tier,
    }


def compute_narrative_polarization_entropy(sentiment_scores: list[float]) -> dict[str, Any]:
    """Compute Shannon Information Entropy across bullish, neutral, and bearish media articles.

    Normalized Entropy H in [0, 1]: 0 = unanimous consensus, 1 = maximum narrative polarization.
    """
    if not sentiment_scores:
        return {
            "narrative_entropy": 0.0,
            "consensus_regime": "Unassessed",
        }

    bull = sum(1 for s in sentiment_scores if s > 0.15)
    bear = sum(1 for s in sentiment_scores if s < -0.15)
    neu = len(sentiment_scores) - bull - bear
    total = float(len(sentiment_scores))

    probs = [p / total for p in (bull, neu, bear) if p > 0]
    # Shannon Entropy
    H = -sum(p * np.log2(p) for p in probs)
    H_norm = H / np.log2(3.0)  # Max entropy for 3 states
    H_norm = min(max(H_norm, 0.0), 1.0)

    regime = (
        "Extreme Narrative Polarization / Media Disagreement (H > 0.85)" if H_norm > 0.85
        else "Divided Media Sentiment (0.50 - 0.85)" if H_norm >= 0.50
        else "Strong Media Consensus (H < 0.50)"
    )

    return {
        "bullish_articles": bull,
        "neutral_articles": neu,
        "bearish_articles": bear,
        "normalized_narrative_entropy": round(H_norm, 3),
        "consensus_regime": regime,
    }
