"""Corporate PDF Document & Earnings Call Transcript Extractor.

Parses local PDF annual reports, earnings call transcripts, investor presentations,
and SEBI statutory disclosures, evaluating management tone, forward guidance commitments,
Gunning Fog complexity, and Q&A evasive verbal hedging.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import zlib
from pathlib import Path
from typing import Any

from .sentiment import (
    compute_governance_red_flags,
    compute_linguistic_complexity_and_fog_index,
    compute_qa_evasion_score,
    compute_uncertainty_hedging_score,
    extract_forward_guidance_and_targets,
)

log = logging.getLogger(__name__)


def _extract_pdf_stream_text(raw_bytes: bytes) -> str:
    """Pure-Python standard library PDF stream text extractor."""
    text_chunks: list[str] = []

    # 1. Search for uncompressed text blocks (BT ... ET)
    bt_blocks = re.findall(rb"BT\s*(.*?)\s*ET", raw_bytes, re.DOTALL)
    for block in bt_blocks:
        # Extract text in parentheses (Tj / TJ operators)
        tj_matches = re.findall(rb"\((.*?)\)\s*Tj", block, re.DOTALL)
        for tj in tj_matches:
            try:
                text_chunks.append(tj.decode("utf-8", errors="ignore"))
            except Exception:
                pass

    # 2. Search for compressed FlateDecode streams
    streams = re.findall(rb"stream[\r\n]+(.*?)[\r\n]+endstream", raw_bytes, re.DOTALL)
    for stream in streams:
        try:
            decompressed = zlib.decompress(stream)
            sub_bt = re.findall(rb"BT\s*(.*?)\s*ET", decompressed, re.DOTALL)
            for block in sub_bt:
                tj_matches = re.findall(rb"\((.*?)\)\s*Tj", block, re.DOTALL)
                for tj in tj_matches:
                    text_chunks.append(tj.decode("utf-8", errors="ignore"))
                # Also handle TJ array of strings: [(text) 20 (more text)] TJ
                tj_arrays = re.findall(rb"\[(.*?)\]\s*TJ", block, re.DOTALL)
                for tja in tj_arrays:
                    inner_strs = re.findall(rb"\((.*?)\)", tja)
                    for s in inner_strs:
                        text_chunks.append(s.decode("utf-8", errors="ignore"))
        except Exception:
            continue

    joined = " ".join(text_chunks).strip()
    if not joined:
        # Fallback to general printable ASCII sequences
        printable = re.findall(rb"[A-Za-z0-9 ,.;:!?'\"\(\)\-\%\$]{4,}", raw_bytes)
        joined = " ".join(p.decode("latin1", errors="ignore") for p in printable)

    return re.sub(r"\s+", " ", joined)


def extract_pdf_text(pdf_path: Path | str) -> str:
    """Extract raw text from a PDF file."""
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")

    # Try third-party libraries if available (pypdf, pdfplumber)
    try:
        import pypdf
        reader = pypdf.PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            return re.sub(r"\s+", " ", text).strip()
    except ImportError:
        pass
    except Exception as exc:
        log.warning("pypdf extraction failed (%s), using pure-Python extractor", exc)

    # Fallback to standard library stream extractor
    raw_bytes = path.read_bytes()
    return _extract_pdf_stream_text(raw_bytes)


def analyze_transcript_pdf(
    pdf_path: Path | str,
    company: str | None = None,
    document_type: str = "Earnings Call Transcript",
) -> dict[str, Any]:
    """Extract and perform deep NLP & forensic linguistic diagnostics on a corporate PDF."""
    path = Path(pdf_path)
    text = extract_pdf_text(path)

    words = re.findall(r"\b\w+\b", text)
    word_count = len(words)

    # 1. Linguistic Complexity & Gunning Fog
    fog = compute_linguistic_complexity_and_fog_index(text)

    # 2. Analyst Q&A Executive Evasion Scorer
    evasion = compute_qa_evasion_score(text)

    # 3. Forward Guidance & Targets
    guidance = extract_forward_guidance_and_targets(text)

    # 4. Uncertainty & Modal Hedging (Loughran-McDonald)
    uncertainty = compute_uncertainty_hedging_score(text)

    # 5. Corporate Governance Red Flags
    gov_flags = compute_governance_red_flags(text)

    # Overall Executive Credibility Tier
    evasion_density = evasion.get("evasion_density_pct", 0.0)
    gov_count = gov_flags.get("governance_flag_count", 0)
    fog_idx = fog.get("gunning_fog_index", 12.0)

    if gov_count >= 2 or evasion_density > 2.0 or fog_idx > 20.0:
        credibility = "High Evasion / Forensic Scrutiny Warranted (Caution)"
    elif evasion_density > 0.8 or fog_idx > 15.0:
        credibility = "Moderate Hedging / Standard Corporate Rhetoric"
    else:
        credibility = "High Directness & Transparent Executive Guidance"

    return {
        "file_name": path.name,
        "company": company or path.stem.replace("_", " ").title(),
        "document_type": document_type,
        "word_count": word_count,
        "executive_credibility_tier": credibility,
        "linguistic_complexity": fog,
        "qa_evasion_diagnostics": evasion,
        "forward_guidance_commitments": guidance,
        "uncertainty_hedging": uncertainty,
        "governance_red_flags": gov_flags,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Corporate PDF Transcript & Document Extractor")
    parser.add_argument("--pdf", required=True, help="Path to local PDF file")
    parser.add_argument("--company", default=None, help="Company name")
    parser.add_argument("--type", default="Earnings Call Transcript", help="Document type")
    parser.add_argument("--out", default=None, help="Output JSON path")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    result = analyze_transcript_pdf(args.pdf, company=args.company, document_type=args.type)

    print(f"\n{'=' * 74}\nCORPORATE TRANSCRIPT & PDF FORENSIC REPORT: {result['company']}")
    print(f"{result['document_type']} ({result['word_count']:,} words)\n{'=' * 74}")
    print(f"Credibility Rating: {result['executive_credibility_tier']}")
    print(f"Gunning Fog Index: {result['linguistic_complexity']['gunning_fog_index']} ({result['linguistic_complexity']['readability_tier']})")
    print(f"Q&A Evasion Density: {result['qa_evasion_diagnostics']['evasion_density_pct']}% ({result['qa_evasion_diagnostics']['executive_directness_tier']})")
    print(f"Forward Guidance Tier: {result['forward_guidance_commitments']['guidance_tier']}")
    print(f"Governance Red Flags: {result['governance_red_flags']['governance_severity']} ({result['governance_red_flags']['governance_flag_count']} flags)")

    if args.out:
        raw_out = Path(args.out)
        if raw_out.parent == Path(".") or str(raw_out.parent) == "":
            out_p = Path("json") / raw_out.name
        elif raw_out.parent == Path("out") and raw_out.suffix == ".json":
            out_p = Path("json") / raw_out.name
        else:
            out_p = raw_out
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"\nwrote {out_p}")


if __name__ == "__main__":
    main()
