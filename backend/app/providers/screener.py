"""
Quarterly results from screener.in, the second source behind Yahoo.

Yahoo's quarterly statements for some Indian issuers stop updating or skip a
quarter (HDFCBANK's newest was June 2025 in November 2026). Screener carries the
consolidated results as filed with the exchanges, in rupees crore.

Its lines are mapped onto the same definitions the Yahoo rows use, so a table
built from either source reads the same way:

    operating profit  = Screener "Operating Profit" - depreciation   (EBIT before other income)
    EBITDA            = Screener "Operating Profit" + other income
    net profit, EPS   = as filed

Lenders report "Financing Profit" instead of an operating line; for them the
operating fields are left empty rather than approximated.
"""

from __future__ import annotations

import calendar
import re
import urllib.parse
from collections import Counter
from datetime import date
from typing import Any

import requests
from bs4 import BeautifulSoup

URL = "https://www.screener.in/company/{symbol}/{kind}/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
_FQ_BY_MONTH = {6: 1, 9: 2, 12: 3, 3: 4}
_MONTHS = {m: i for i, m in enumerate(calendar.month_abbr) if m}


def _number(text: str) -> float | None:
    t = text.replace(",", "").replace("%", "").strip()
    if not t or t in {"-", "—"}:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _period_end(label: str) -> date | None:
    m = re.fullmatch(r"([A-Z][a-z]{2}) (\d{4})", label.strip())
    if not m or m.group(1) not in _MONTHS:
        return None
    year, month = int(m.group(2)), _MONTHS[m.group(1)]
    return date(year, month, calendar.monthrange(year, month)[1])


def _fiscal_label(d: date) -> str:
    q = _FQ_BY_MONTH.get(d.month)
    if q is None:
        return d.strftime("%b %Y")
    return f"Q{q} FY{str(d.year + 1 if d.month >= 6 else d.year)[-2:]}"


def _annual_month(periods: list[date | None]) -> int:
    valid = [d.month for d in periods if d is not None]
    if not valid or 3 in valid:
        return 3
    return Counter(valid).most_common(1)[0][0]


def _table(soup: BeautifulSoup, section: str) -> tuple[list[date | None], dict[str, list[float | None]]] | None:
    """Period ends and numeric lines of one results table. Non-date columns (TTM) map to None."""
    table = soup.select_one(f"{section} table")
    if table is None:
        return None
    grid = [[c.get_text(" ", strip=True) for c in tr.select("th,td")] for tr in table.select("tr")]
    if not grid or len(grid[0]) < 2:
        return None
    periods = [_period_end(h) for h in grid[0][1:]]
    # "Sales +" / "Net Profit +": the trailing "+" is an expand control
    lines = {row[0].rstrip(" +").strip(): [_number(v) for v in row[1:]] for row in grid[1:] if row}
    return periods, lines


def _line(lines: dict[str, list[float | None]], n: int, *names: str) -> list[float | None]:
    for name in names:
        if name in lines:
            return lines[name]
    return [None] * n


def _pnl(soup: BeautifulSoup, section: str, annual: bool) -> list[dict[str, Any]]:
    parsed = _table(soup, section)
    if parsed is None:
        return []
    periods, lines = parsed
    n = len(periods)
    revenue = _line(lines, n, "Sales", "Revenue")
    op = _line(lines, n, "Operating Profit")
    depreciation = _line(lines, n, "Depreciation")
    other = _line(lines, n, "Other Income")
    net = _line(lines, n, "Net Profit")
    eps = _line(lines, n, "EPS in Rs")
    lender = "Financing Profit" in lines
    fy_month = _annual_month(periods) if annual else None

    rows: list[dict[str, Any]] = []
    for i, end in enumerate(periods):
        if end is None or not revenue[i] or (annual and end.month != fy_month):
            continue
        ebit = None if lender or op[i] is None else round(op[i] - (depreciation[i] or 0), 2)
        row: dict[str, Any] = {
            "periodEnd": end.isoformat(),
            "revenue": revenue[i],
            "operatingProfit": ebit,
            "opmPct": None if ebit is None else round(ebit / revenue[i] * 100, 2),
            "netProfit": net[i],
            # Lenders' revenue here is gross interest earned; Yahoo's is net of interest paid
            "lender": lender,
        }
        if annual:
            row = {"period": f"FY{str(end.year)[-2:]}", **row, "eps": eps[i]}
        else:
            row = {
                "quarter": _fiscal_label(end),
                **row,
                "operatingExpenses": None if ebit is None else round(revenue[i] - ebit, 2),
                "ebitda": None if lender or op[i] is None else round(op[i] + (other[i] or 0), 2),
                "netMarginPct": None if net[i] is None else round(net[i] / revenue[i] * 100, 2),
                "eps": eps[i],
            }
        rows.append(row)
    return rows


def _balance(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Fiscal year-end balance sheets. Screener gives no current assets or liabilities, so those stay empty."""
    parsed = _table(soup, "#balance-sheet")
    if parsed is None:
        return []
    periods, lines = parsed
    n = len(periods)
    capital = _line(lines, n, "Equity Capital")
    reserves = _line(lines, n, "Reserves")
    borrowings = _line(lines, n, "Borrowings", "Borrowing")
    assets = _line(lines, n, "Total Assets")
    fy_month = _annual_month(periods)
    rows: list[dict[str, Any]] = []
    for i, end in enumerate(periods):
        if end is None or end.month != fy_month or capital[i] is None or reserves[i] is None:
            continue
        worth = capital[i] + reserves[i]
        rows.append(
            {
                "period": f"FY{str(end.year)[-2:]}",
                "periodEnd": end.isoformat(),
                "borrowings": borrowings[i],
                "equityCapital": capital[i],
                "reserves": reserves[i],
                "netWorth": round(worth, 2),
                "totalAssets": assets[i],
                "currentAssets": None,
                "currentLiabilities": None,
                "debtToEquity": round(borrowings[i] / worth, 3) if borrowings[i] is not None and worth else None,
                "currentRatio": None,
            }
        )
    return rows


def _classification(soup: BeautifulSoup) -> dict[str, Any] | None:
    """Screener's four-level classification and the link to the company's industry page."""
    links = soup.select("#peers p.sub a[title]")
    levels = {a.get("title"): {"name": a.get_text(strip=True), "path": a.get("href")} for a in links}
    industry = levels.get("Industry")
    if not industry:
        return None
    return {
        "broadSector": (levels.get("Broad Sector") or {}).get("name"),
        "sector": (levels.get("Sector") or {}).get("name"),
        "broadIndustry": (levels.get("Broad Industry") or {}).get("name"),
        "industry": industry["name"],
        "industryPath": industry["path"],
    }


def parse_company(html: str) -> dict[str, Any]:
    """Quarterly results, annual results and year-end balance sheets, oldest first, and the classification."""
    soup = BeautifulSoup(html, "lxml")
    return {
        "quarterly": _pnl(soup, "#quarters", annual=False),
        "annual": _pnl(soup, "#profit-loss", annual=True),
        "balanceSheet": _balance(soup),
        "classification": _classification(soup),
    }


def parse_quarters(html: str) -> list[dict[str, Any]]:
    return parse_company(html)["quarterly"]


def fetch_company(symbol: str) -> dict[str, Any]:
    """The parsed company page, cached so financials and peers share one request."""
    from ..cache import CACHE

    data, _ = CACHE.get_or_fetch(f"screener:company:{symbol.upper()}", 6 * 3600, lambda: _fetch_company(symbol))
    return data


def _fetch_company(symbol: str) -> dict[str, Any]:
    """Consolidated results, falling back to standalone where a company files none."""
    encoded = urllib.parse.quote(symbol.upper(), safe="")
    for kind in ("consolidated", ""):
        url = URL.format(symbol=encoded, kind=kind).replace("//", "/").replace("https:/", "https://")
        res = requests.get(url, headers=UA, timeout=30)
        if res.status_code == 429 or res.status_code >= 500:
            res.raise_for_status()
        if res.status_code != 200:
            continue
        parsed = parse_company(res.text)
        if parsed["quarterly"] or parsed["annual"]:
            # The same eight-quarter window the primary source gives
            return {**parsed, "quarterly": parsed["quarterly"][-8:], "url": url, "basis": kind or "standalone"}
    return {"quarterly": [], "annual": [], "balanceSheet": [], "classification": None, "url": None, "basis": None}


PEER_COLUMNS = {
    "CMP Rs.": "price", "P/E": "pe", "Mar Cap Rs.Cr.": "marketCapCr", "Div Yld %": "dividendYieldPct",
    "NP Qtr Rs.Cr.": "netProfitQtrCr", "Qtr Profit Var %": "profitGrowthQtrPct", "Sales Qtr Rs.Cr.": "salesQtrCr",
    "Qtr Sales Var %": "salesGrowthQtrPct", "ROCE %": "rocePct",
}


def parse_industry(html: str) -> list[dict[str, Any]]:
    """Companies on a screener.in industry page, with the symbol taken from each row's link."""
    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("table")
    if table is None:
        return []
    rows = table.select("tr")
    header = [c.get_text(" ", strip=True) for c in rows[0].select("th,td")] if rows else []
    out = []
    for tr in rows[1:]:
        cells = tr.select("td")
        link = tr.select_one("a[href^='/company/']")
        if not cells or link is None:
            continue
        m = re.match(r"/company/([^/]+)/", link.get("href", ""))
        if not m or m.group(1).isdigit():
            continue  # listed only on BSE: screener links those by BSE code
        row: dict[str, Any] = {"symbol": m.group(1).upper(), "name": link.get_text(" ", strip=True)}
        for name, cell in zip(header, [c.get_text(" ", strip=True) for c in cells]):
            if name in PEER_COLUMNS:
                row[PEER_COLUMNS[name]] = _number(cell)
        out.append(row)
    return out


def fetch_industry(path: str) -> list[dict[str, Any]]:
    res = requests.get(f"https://www.screener.in{path}", headers=UA, timeout=30)
    res.raise_for_status()
    return parse_industry(res.text)
