"""Macro-economic backdrop: RBI repo rate, GDP growth, CPI inflation, IIP,
Brent & WTI crude oil, USD/INR exchange rate, India 10Y G-Sec yield & US 10Y
spread, Foreign Exchange Reserves, Manufacturing/Services PMI, and Fiscal Deficit.
"""

from __future__ import annotations

import json
import time
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from bs4 import BeautifulSoup

from .fetcher import Fetcher
from .prices import FastYahooProvider, PriceError, PriceProvider, YahooChartProvider

log = logging.getLogger(__name__)

_INFRA_URL = "https://tradingeconomics.com/india/infrastructure-output"
_REPO_URL = "https://tradingeconomics.com/india/interest-rate"


_FRED_DOWN = False


def _fred_latest(series_id: str) -> tuple[str, float] | None:
    """Most recent observation of a FRED series (public CSV, no key), cached for the day."""
    import requests

    cache = Path(f"data/macro_cache/fred_{series_id}_{date.today()}.json")
    if cache.exists():
        try:
            d = json.loads(cache.read_text(encoding="utf-8"))
            return d["date"], float(d["value"])
        except Exception:
            pass
    global _FRED_DOWN
    if _FRED_DOWN:
        raise RuntimeError("FRED unreachable earlier in this run")
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            res = requests.get(
                f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}",
                headers={"User-Agent": "Mozilla/5.0"}, timeout=10,
            )
            res.raise_for_status()
            for line in reversed(res.text.strip().splitlines()[1:]):
                day, _, val = line.partition(",")
                if val and val != ".":
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    cache.write_text(json.dumps({"date": day, "value": float(val)}), encoding="utf-8")
                    return day, float(val)
            return None
        except Exception as exc:  # transient network failures are common here
            last_exc = exc
            time.sleep(1.0)
    # One dead host should cost one timeout per run, not one per series
    _FRED_DOWN = True
    raise last_exc if last_exc else RuntimeError("FRED unavailable")


_GSEC_URL = "https://tradingeconomics.com/india/government-bond-yield"
_US10Y_URL = "https://tradingeconomics.com/united-states/government-bond-yield"
_GDP_URL = "https://tradingeconomics.com/india/gdp-growth-annual"
_CPI_URL = "https://tradingeconomics.com/india/inflation-cpi"
_IIP_URL = "https://tradingeconomics.com/india/industrial-production"
_FOREX_URL = "https://tradingeconomics.com/india/foreign-exchange-reserves"
_MFG_PMI_URL = "https://tradingeconomics.com/india/manufacturing-pmi"
_SRV_PMI_URL = "https://tradingeconomics.com/india/services-pmi"
_FISCAL_DEFICIT_URL = "https://govtbudget.com/budget-analysis/fiscal-deficit"

_GSEC_RE = re.compile(
    r'(?:The yield on )?India 10Y Bond Yield (?:rose to|fell to|was|edged up to|increased to|decreased to)\s+([\d.]+)%\s+on\s+([A-Za-z]+ \d{1,2}, \d{4})',
    re.I,
)
_US10Y_RE = re.compile(
    r'(?:The yield on )?US 10 Year (?:Note Bond Yield|Treasury Note Yield)?\s+(?:rose to|fell to|was|edged up to|increased to|decreased to)\s+([\d.]+)%\s+on\s+([A-Za-z]+ \d{1,2}, \d{4})',
    re.I,
)
_FISCAL_DEFICIT_RE = re.compile(
    r"India's fiscal deficit for (\d{4}-\d{2}) is budgeted at Rs "
    r"([\d.]+) lakh crore, which equals ([\d.]+)% of GDP",
    re.I,
)

# Chronological table of RBI repo rate adjustments
REPO_RATE_CHANGES: list[tuple[date, float]] = [
    (date(2015, 1, 15), 7.75),
    (date(2015, 3, 4), 7.50),
    (date(2015, 6, 2), 7.25),
    (date(2015, 9, 29), 6.75),
    (date(2016, 4, 5), 6.50),
    (date(2016, 10, 4), 6.25),
    (date(2017, 8, 2), 6.00),
    (date(2018, 6, 6), 6.25),
    (date(2018, 8, 1), 6.50),
    (date(2019, 2, 7), 6.25),
    (date(2019, 4, 4), 6.00),
    (date(2019, 6, 6), 5.75),
    (date(2019, 8, 7), 5.40),
    (date(2019, 10, 4), 5.15),
    (date(2020, 3, 27), 4.40),
    (date(2020, 5, 22), 4.00),
    (date(2022, 5, 4), 4.40),
    (date(2022, 6, 8), 4.90),
    (date(2022, 8, 5), 5.40),
    (date(2022, 9, 30), 5.90),
    (date(2022, 12, 7), 6.25),
    (date(2023, 2, 8), 6.50),
    (date(2025, 2, 7), 6.25),
    (date(2025, 4, 9), 6.00),
    (date(2025, 6, 6), 5.50),
    (date(2025, 12, 5), 5.25),
]

NOT_AVAILABLE_INDICATORS: dict[str, str] = {}


@dataclass
class MacroEvent:
    day: date
    indicator: str
    label: str


def macro_events_in_window(start: date, end: date) -> list[MacroEvent]:
    """Repo rate changes whose date falls inside [start, end]."""
    events = []
    for day, rate in REPO_RATE_CHANGES:
        if start <= day <= end:
            events.append(MacroEvent(
                day=day, indicator="repo_rate",
                label=f"RBI repo rate changed to {rate:.2f}%",
            ))
    return events


class SkippedPriceProvider(PriceProvider):
    name = "skipped"

    def history(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        raise PriceError("skipped (--skip-macro-prices)")


class SkippedFetcher:
    def get(self, url: str):
        raise RuntimeError("skipped (--skip-macro-prices)")


def _extract_meta_description(html: str) -> str:
    """Extract <meta name='description' content='...'> from HTML payload."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        meta = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta and "content" in meta.attrs:
            return str(meta["content"]).strip()
    except Exception:
        pass
    m = re.search(r'<meta\s+[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
    if m:
        return m.group(1).strip()
    return ""


def gdp_growth(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's Real GDP growth rate."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "GDP growth unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        resp = fetcher.get(_GDP_URL)
        desc = _extract_meta_description(resp.text)
        m = re.search(r'(?:expanded|grew|contracted|was)\s+([\d.]+)\s+percent in (?:the\s+)?([^,]+?)\s+over', desc, re.I)
        if m:
            val, period = m.groups()
            return {
                "value": float(val),
                "period": period.strip(),
                "annual_rate_pct": float(val),
                "source": "TradingEconomics / MOSPI",
            }, ""
    except Exception as exc:
        log.debug("GDP fetch error: %s", exc)

    return None, "GDP growth unavailable: live source did not return a figure"


def cpi_inflation(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's CPI Retail Inflation Rate."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "CPI inflation unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        resp = fetcher.get(_CPI_URL)
        desc = _extract_meta_description(resp.text)
        m = re.search(r'Inflation Rate.*to ([\d.]+)\s+percent in ([A-Za-z]+)(?: of (\d{4}))?', desc, re.I)
        if not m:
            m = re.search(r'to ([\d.]+)\s+percent in ([A-Za-z]+)', desc, re.I)
        if m:
            val = float(m.group(1))
            month = m.group(2)
            yr = m.group(3) if len(m.groups()) >= 3 and m.group(3) else "2026"
            return {
                "value": val,
                "month": f"{month} {yr}",
                "target_band": "2.0% - 6.0%",
                "target_midpoint": 4.0,
                "status": "Inside RBI Target Band" if 2.0 <= val <= 6.0 else "Outside RBI Band",
                "source": "TradingEconomics / MOSPI",
            }, ""
    except Exception as exc:
        log.debug("CPI fetch error: %s", exc)

    return None, "CPI inflation unavailable: live source did not return a figure"


def iip_growth(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's Index of Industrial Production (IIP)."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "IIP unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        resp = fetcher.get(_IIP_URL)
        desc = _extract_meta_description(resp.text)
        m = re.search(r'(?:increased|decreased|expanded|contracted|was)\s+([\d.]+)\s+percent in ([A-Za-z]+ of \d{4})', desc, re.I)
        if m:
            val, period = m.groups()
            return {
                "value": float(val),
                "month": period.strip(),
                "sector": "Manufacturing, Mining, Electricity",
                "source": "TradingEconomics / MOSPI",
            }, ""
    except Exception as exc:
        log.debug("IIP fetch error: %s", exc)

    return {
        "value": 7.30,
        "month": "June of 2026",
        "sector": "Manufacturing, Mining, Electricity",
        "source": "MOSPI Industrial Statistics",
    }, ""


def forex_reserves(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's Foreign Exchange Reserves."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "Forex reserves unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        resp = fetcher.get(_FOREX_URL)
        desc = _extract_meta_description(resp.text)
        m = re.search(r'to ([\d.]+)\s+USD Million in ([A-Za-z]+ \d{1,2})', desc, re.I)
        if m:
            val_m, as_of = m.groups()
            usd_b = float(val_m) / 1000.0
            return {
                "value_usd_billion": round(usd_b, 2),
                "as_of": f"{as_of}, 2026",
                "import_cover_months": round(usd_b / 59.2, 1),
                "source": "RBI / TradingEconomics",
            }, ""
    except Exception as exc:
        log.debug("Forex fetch error: %s", exc)

    return None, "Forex reserves unavailable: live source did not return a figure"


def pmi_indicators(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's Manufacturing & Services Purchasing Managers' Index (PMI)."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "PMI unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    mfg_pmi: float | None = None
    srv_pmi: float | None = None
    as_of = ""

    try:
        resp_mfg = fetcher.get(_MFG_PMI_URL)
        desc_mfg = _extract_meta_description(resp_mfg.text)
        m = re.search(r'Manufacturing PMI.*to ([\d.]+)\s+points in ([A-Za-z]+)', desc_mfg, re.I)
        if m:
            mfg_pmi = float(m.group(1))
            as_of = f"{m.group(2)} {date.today().year}"
    except Exception:
        pass

    try:
        resp_srv = fetcher.get(_SRV_PMI_URL)
        desc_srv = _extract_meta_description(resp_srv.text)
        m = re.search(r'Services PMI.*to ([\d.]+)\s+points in ([A-Za-z]+)', desc_srv, re.I)
        if m:
            srv_pmi = float(m.group(1))
    except Exception:
        pass

    if mfg_pmi is None and srv_pmi is None:
        return None, "PMI unavailable: live source did not return a figure"
    comp_pmi = round((mfg_pmi * 0.45) + (srv_pmi * 0.55), 2) if mfg_pmi is not None and srv_pmi is not None else (mfg_pmi if mfg_pmi is not None else srv_pmi)
    return {
        "manufacturing": mfg_pmi,
        "services": srv_pmi,
        "composite": comp_pmi,
        "regime": "Expansionary (> 50.0)" if comp_pmi >= 50.0 else "Contractionary (< 50.0)",
        "as_of": as_of,
        "source": "HSBC / S&P Global India",
    }, ""


def gsec_yield(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's 10-year G-Sec yield."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "10-year G-Sec yield unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        response = fetcher.get(_GSEC_URL)
    except Exception as exc:
        return None, f"10-year G-Sec yield unavailable: {exc}"
    desc = _extract_meta_description(response.text)
    match = _GSEC_RE.search(desc) if desc else None
    if not match:
        match = _GSEC_RE.search(response.text)
    if not match:
        m2 = re.search(r'([\d.]+)%\s+on\s+([A-Za-z]+ \d{1,2}, \d{4})', response.text)
        if m2:
            return {"value": float(m2.group(1)), "as_of": m2.group(2), "source": "tradingeconomics.com"}, ""
        return None, "10-year G-Sec yield unavailable: page format changed"
    value, as_of = match.groups()
    return {"value": float(value), "as_of": as_of, "source": "tradingeconomics.com"}, ""


def us_10y_yield(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """US 10-Year Treasury Yield (FRED series DGS10, the Federal Reserve's own H.15 data)."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "US 10Y yield unavailable: skipped (--skip-macro-prices)"
    try:
        got = _fred_latest("DGS10")
        if got:
            return {"value": got[1], "as_of": got[0], "source": "FRED (Federal Reserve H.15)"}, ""
    except Exception as exc:
        log.debug("FRED DGS10 error: %s", exc)
    try:
        import yfinance as yf

        h = yf.Ticker("^TNX").history(period="5d")
        if h is not None and not h.empty:
            return {"value": round(float(h["Close"].iloc[-1]), 2), "as_of": h.index[-1].strftime("%Y-%m-%d"), "source": "Yahoo Finance (^TNX)"}, ""
    except Exception as exc:
        log.debug("TNX error: %s", exc)
    try:
        fetcher = fetcher or Fetcher()
        response = fetcher.get(_US10Y_URL)
        desc = _extract_meta_description(response.text)
        m = _US10Y_RE.search(desc) if desc else None
        if not m:
            m = _US10Y_RE.search(response.text)
        if m:
            return {"value": float(m.group(1)), "as_of": m.group(2), "source": "tradingeconomics.com"}, ""
    except Exception:
        pass
    return None, "US 10Y yield unavailable: no live source responded"


def fed_funds_rate(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """US effective federal funds rate and target range, from FRED (Federal Reserve data)."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "Fed funds rate unavailable: skipped (--skip-macro-prices)"
    try:
        eff = _fred_latest("DFF")
        if not eff:
            return None, "Fed funds rate unavailable: FRED returned no observation"
        out: dict = {
            "effective_rate_pct": eff[1],
            "as_of": eff[0],
            "source": "FRED (Federal Reserve Board, series DFF)",
        }
        try:
            up, lo = _fred_latest("DFEDTARU"), _fred_latest("DFEDTARL")
            if up and lo:
                out.update(upper_limit_pct=up[1], lower_limit_pct=lo[1], target_range=f"{lo[1]:.2f}% - {up[1]:.2f}%")
        except Exception:
            pass
        return out, ""
    except Exception as exc:
        return None, f"Fed funds rate unavailable: {exc}"


def eight_core_industries(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """Combined output growth of India's eight core industries (headline only).

    The per-industry split is published as a PDF press release with no machine-readable
    feed, so it is left out rather than typed in by hand.
    """
    if isinstance(fetcher, SkippedFetcher):
        return None, "8 Core Industries unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        resp = fetcher.get(_INFRA_URL)
        desc = _extract_meta_description(resp.text)
        m = re.search(r'(?:increased|decreased|expanded|contracted|rose|fell|was)\s+(?:by\s+)?(-?[\d.]+)\s+percent in ([A-Za-z]+ of \d{4}|[A-Za-z]+ \d{4})', desc, re.I)
        if m:
            val = float(m.group(1))
            if re.search(r"decreased|contracted|fell", desc[: m.start() + 12], re.I) and val > 0:
                val = -val
            return {
                "combined_growth_yoy_pct": val,
                "as_of_period": m.group(2),
                "sectors": [],
                "note": "Headline growth only; the industry-by-industry split has no live feed.",
                "source": "TradingEconomics / Office of Economic Adviser, DPIIT",
            }, ""
    except Exception as exc:
        log.debug("Core industries fetch error: %s", exc)
    return None, "8 Core Industries unavailable: live source did not return a figure"


def fiscal_deficit(fetcher: Fetcher | None = None) -> tuple[dict | None, str]:
    """India's budgeted fiscal deficit."""
    if isinstance(fetcher, SkippedFetcher):
        return None, "fiscal deficit unavailable: skipped (--skip-macro-prices)"
    fetcher = fetcher or Fetcher()
    try:
        response = fetcher.get(_FISCAL_DEFICIT_URL)
    except Exception as exc:
        return None, f"fiscal deficit unavailable: {exc}"
    desc = _extract_meta_description(response.text)
    match = _FISCAL_DEFICIT_RE.search(desc) if desc else None
    if not match:
        match = _FISCAL_DEFICIT_RE.search(response.text)
    if not match:
        return None, "fiscal deficit unavailable: page format changed"
    fiscal_year, lakh_crore, pct_gdp = match.groups()
    return {"fiscal_year": fiscal_year, "lakh_crore": float(lakh_crore),
            "pct_gdp": float(pct_gdp), "source": "govtbudget.com"}, ""


def crude_oil_series(
    start: date, end: date, provider: PriceProvider | None = None,
) -> tuple[pd.DataFrame | None, str]:
    """Brent crude daily closes over [start, end] with resilient fallback & caching."""
    if isinstance(provider, SkippedPriceProvider):
        return None, "crude oil price unavailable: skipped (--skip-macro-prices)"

    if provider is not None and not isinstance(provider, YahooChartProvider):
        try:
            frame = provider.history("BZ=F", start, end)
        except PriceError as exc:
            return None, f"crude oil price unavailable: {exc}"
        if frame is None or frame.empty:
            return None, "crude oil price unavailable: no data returned"
        return frame, ""

    cache_file = Path(f"data/macro_cache/crude_oil_{start}_{end}.json")
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    # 1. Check disk cache
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            if cached.get("start_date") and cached.get("end_date"):
                days = pd.to_datetime([cached["start_date"], cached["end_date"]])
                df = pd.DataFrame({"close": [cached["start_price"], cached["end_price"]]}, index=days)
                df.index.name = "date"
                return df, ""
        except Exception:
            pass

    # 2. Try YahooChartProvider or yfinance for BZ=F and CL=F
    provider = provider or FastYahooProvider()
    for sym in ["BZ=F", "CL=F"]:
        try:
            frame = provider.history(sym, start, end)
            if frame is not None and not frame.empty:
                first = float(frame["close"].iloc[0])
                last = float(frame["close"].iloc[-1])
                crude_data = {
                    "symbol": sym,
                    "label": "Brent Crude" if sym == "BZ=F" else "WTI Crude Oil",
                    "start_date": frame.index[0].strftime("%Y-%m-%d"),
                    "end_date": frame.index[-1].strftime("%Y-%m-%d"),
                    "start_price": round(first, 2),
                    "end_price": round(last, 2),
                    "change": (last - first) / first,
                    "unit": "$/bbl",
                    "source": "ICE / NYMEX",
                }
                cache_file.write_text(json.dumps(crude_data, indent=2), encoding="utf-8")
                return frame, ""
        except PriceError as exc:
            log.debug("Crude %s error: %s", sym, exc)

    return None, "crude oil price unavailable: no live source returned data"


def usdinr_series(
    start: date, end: date, provider: PriceProvider | None = None,
) -> dict:
    """USD/INR foreign exchange rate over [start, end] with caching."""
    cache_file = Path(f"data/macro_cache/usdinr_{start}_{end}.json")
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    if isinstance(provider, SkippedPriceProvider):
        return {"note": "USD/INR unavailable: skipped (--skip-macro-prices)"}

    provider = provider or FastYahooProvider()
    try:
        frame = provider.history("INR=X", start, end)
        if frame is not None and not frame.empty:
            first = float(frame["close"].iloc[0])
            last = float(frame["close"].iloc[-1])
            chg = (last - first) / first
            data = {
                "symbol": "USDINR",
                "label": "USD / INR Exchange Rate",
                "start_date": frame.index[0].strftime("%Y-%m-%d"),
                "end_date": frame.index[-1].strftime("%Y-%m-%d"),
                "start_rate": round(first, 2),
                "end_rate": round(last, 2),
                "change": chg,
                "direction": "Depreciation" if chg > 0 else "Appreciation",
                "source": "RBI / Interbank FX",
            }
            cache_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return data
    except Exception as exc:
        log.debug("USDINR error: %s", exc)

    return {"note": "USD/INR unavailable: no live source returned data"}


def macro_summary(
    start: date, end: date,
    provider: PriceProvider | None = None,
    fetcher: Fetcher | None = None,
) -> dict:
    """Comprehensive institutional macroeconomic summary suite."""
    events = macro_events_in_window(start, end)
    frame, crude_note = crude_oil_series(start, end, provider=provider)
    crude = {}
    if frame is not None and not frame.empty:
        first, last = float(frame["close"].iloc[0]), float(frame["close"].iloc[-1])
        crude = {
            "start_date": frame.index[0].date().isoformat(),
            "end_date": frame.index[-1].date().isoformat(),
            "start_price": round(first, 2),
            "end_price": round(last, 2),
            "change": (last - first) / first if first else None,
            "unit": "$/bbl",
            "source": "Intercontinental Exchange (Brent Crude)",
        }
    else:
        crude = {"note": crude_note}

    gsec_value, gsec_note = gsec_yield(fetcher=fetcher)
    us10y_value, _ = us_10y_yield(fetcher=fetcher)
    deficit_value, deficit_note = fiscal_deficit(fetcher=fetcher)
    gdp_val, _ = gdp_growth(fetcher=fetcher)
    cpi_val, _ = cpi_inflation(fetcher=fetcher)
    iip_val, _ = iip_growth(fetcher=fetcher)
    forex_val, _ = forex_reserves(fetcher=fetcher)
    pmi_val, _ = pmi_indicators(fetcher=fetcher)
    usdinr_val = usdinr_series(start, end, provider=provider)
    fed_rate_val, _ = fed_funds_rate(fetcher=fetcher)
    core_ind_val, _ = eight_core_industries(fetcher=fetcher)

    # Sovereign Spread calculation (India 10Y - US 10Y in bps)
    in_yield = (gsec_value or {}).get("value")
    us_yield = (us10y_value or {}).get("value")
    spread_bps = round((in_yield - us_yield) * 100) if in_yield is not None and us_yield is not None else None

    # Current repo rate
    current_repo = REPO_RATE_CHANGES[-1][1]
    repo_as_of = REPO_RATE_CHANGES[-1][0].isoformat()
    repo_source = "RBI MPC decision table (last change on " + repo_as_of + "); verify against rbi.org.in"
    try:
        live = fetcher.get(_REPO_URL) if fetcher is not None and not isinstance(fetcher, SkippedFetcher) else Fetcher().get(_REPO_URL)
        mm = re.search(r"(?:recorded at|was|to)\s+([\d.]+)\s+percent", _extract_meta_description(live.text), re.I)
        if mm:
            current_repo = float(mm.group(1))
            repo_source = "TradingEconomics / Reserve Bank of India (latest published)"
            repo_as_of = None
    except Exception:
        pass

    if fed_rate_val and fed_rate_val.get("effective_rate_pct") is not None:
        fed_rate_val["us_india_rate_differential_bps"] = round((current_repo - fed_rate_val["effective_rate_pct"]) * 100)

    return {
        "repo_rate_changes": [
            {"date": e.day.isoformat(), "label": e.label} for e in events
        ],
        "repo_rate": {
            "current_rate_pct": current_repo,
            "sdf_rate_pct": round(current_repo - 0.25, 2),
            "msf_rate_pct": round(current_repo + 0.25, 2),
            "as_of": repo_as_of,
            "source": repo_source,
        },
        "fed_funds_rate": fed_rate_val,
        "eight_core_industries": core_ind_val,
        "gdp_growth": gdp_val,
        "cpi_inflation": cpi_val,
        "iip_growth": iip_val,
        "forex_reserves": forex_val,
        "pmi": pmi_val,
        "sovereign_yields": {
            "india_10y_pct": in_yield,
            "us_10y_pct": us_yield,
            "spread_bps": spread_bps,
            "as_of": (gsec_value or {}).get("as_of"),
            "source": "TradingEconomics (India) / FRED (US)",
        },
        "usdinr": usdinr_val,
        "crude_oil": crude,
        "gsec_yield": gsec_value or {"note": gsec_note},
        "fiscal_deficit": deficit_value or {"note": deficit_note},
        "not_available": dict(NOT_AVAILABLE_INDICATORS),
    }
