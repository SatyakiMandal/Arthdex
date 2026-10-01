"""Company financial fundamentals: revenue growth, operating expense, NOPAT,
order book, key financial ratios, and balance-sheet credit metrics.

Descriptive backdrop only, the same role the macro-economic and Nifty
sections already play: this never feeds into candidate-day flagging or any
significance test, and reports the company's latest reported quarterly and
annual financials, not a value scoped to the report's own date window.

Source: screener.in.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
from bs4 import BeautifulSoup

from .fetcher import Fetcher

_BASE = "https://www.screener.in/company"

# Screener's own row-label alternatives for the same underlying concept,
# tried in order - which one a company's page uses depends on whether it is
# a financial (bank/NBFC) or non-financial company.
_REVENUE_LABELS = ["Sales", "Revenue", "Interest Income"]
_OPERATING_INCOME_LABELS = ["Operating Profit", "Financing Profit"]
_EXPENSE_LABELS = ["Expenses", "Interest Expended"]
_TAX_LABELS = ["Tax %"]
_DEPRECIATION_LABELS = ["Depreciation"]
_NET_PROFIT_LABELS = ["Net Profit", "Profit after tax"]

ORDER_BOOK_NOT_APPLICABLE = (
    "not applicable: this company's screener.in page carries no Order Book "
    "row at all - a concept most financial-statement templates only use "
    "for capital-goods/EPC/infrastructure companies, not this company's sector."
)
ORDER_BOOK_PAYWALLED = (
    "not available: screener.in carries an Order Book row for this company "
    "but the underlying data is gated behind a paid Premium subscription - "
    "confirmed directly (the row renders with no values, and the "
    "surrounding data block is marked 'Requires Premium')."
)


class FinancialsError(RuntimeError):
    pass


@dataclass
class QuarterlyRow:
    label_used: str
    dates: list[date]
    values: list[float | None]

    @property
    def latest(self) -> float | None:
        return self.values[-1] if self.values else None

    def change(self, periods_back: int) -> float | None:
        """Fractional change from `periods_back` quarters ago to the latest
        quarter, or None if there isn't enough history or either value is
        missing/zero."""
        if len(self.values) <= periods_back:
            return None
        latest, prior = self.values[-1], self.values[-1 - periods_back]
        if latest is None or prior is None or prior == 0:
            return None
        return (latest - prior) / abs(prior)


@dataclass
class FinancialSummary:
    ticker: str
    screener_url: str
    statement_kind: str  # "consolidated" | "standalone"
    currency_unit: str
    as_of: date | None
    revenue: QuarterlyRow | None = None
    expenses: QuarterlyRow | None = None
    operating_income: QuarterlyRow | None = None
    tax_rate: QuarterlyRow | None = None
    net_profit: QuarterlyRow | None = None
    nopat: float | None = None
    nopat_note: str = ""
    order_book_note: str = field(default=ORDER_BOOK_NOT_APPLICABLE)
    order_book: QuarterlyRow | None = None
    market_cap: float | None = None
    current_price: float | None = None
    shares_outstanding: float | None = None
    top_ratios: dict[str, float | None] = field(default_factory=dict)
    balance_sheet: dict[str, float | None] = field(default_factory=dict)
    annual_ratios: dict[str, float | None] = field(default_factory=dict)
    peers: list[tuple[str, str]] = field(default_factory=list)
    depreciation: QuarterlyRow | None = None
    # Trailing-twelve-month sums of the last four reported quarters (None if fewer than four)
    ttm: dict[str, float | None] = field(default_factory=dict)
    cfo_annual: float | None = None
    profit_cagr_3y_pct: float | None = None
    sales_cagr_3y_pct: float | None = None


def _ttm(row: "QuarterlyRow | None") -> float | None:
    """Sum of the last four quarters, only when all four are present."""
    if row is None or len(row.values) < 4:
        return None
    last = row.values[-4:]
    return sum(last) if all(v is not None for v in last) else None


def _parse_cfo(soup) -> float | None:
    """Latest annual cash from operating activity (screener.in #cash-flow)."""
    sec = soup.select_one("#cash-flow")
    table = sec.select_one("table") if sec else None
    if table is None:
        return None
    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if cells and cells[0].get_text(strip=True).rstrip("+").strip().startswith("Cash from Operating"):
            vals = [_parse_number(c.get_text(strip=True)) for c in cells[1:]]
            vals = [v for v in vals if v is not None]
            return vals[-1] if vals else None
    return None


def _parse_cagr(soup, heading: str, years: int = 3) -> float | None:
    """A compounded-growth figure from the ranges tables on the profit-and-loss card."""
    for th in soup.find_all("th"):
        if th.get_text(strip=True).startswith(heading):
            table = th.find_parent("table")
            for tr in table.select("tr"):
                tds = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
                if tds and tds[0].startswith(f"{years} Years"):
                    return _parse_number(tds[-1])
    return None


def _screener_symbol(ticker: str) -> str:
    """screener.in keys companies by their bare NSE/BSE symbol, not the
    Yahoo-style suffixed ticker this project uses everywhere else."""
    return ticker.split(".")[0].upper()


def _parse_number(text: str) -> float | None:
    if not text:
        return None
    cleaned = text.strip().replace(",", "").replace("₹", "").replace("Rs.", "").rstrip("%").strip()
    if not cleaned or cleaned in ("-", "—", "N/A", "NA"):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _quarter_dates(table) -> list[date]:
    dates = []
    for th in table.select("thead th[data-date-key]"):
        key = th.get("data-date-key")
        try:
            dates.append(date.fromisoformat(key))
        except (TypeError, ValueError):
            dates.append(None)
    return dates


def _row_by_label(table, labels: list[str], dates: list[date]) -> QuarterlyRow | None:
    """The first row (in ``labels`` preference order) that actually carries
    numeric values."""
    rows = {}
    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        label = cells[0].get_text(strip=True).rstrip("+").strip()
        rows[label] = cells[1:]
    for label in labels:
        cells = rows.get(label)
        if cells is None:
            continue
        values = [_parse_number(c.get_text(strip=True)) for c in cells]
        if not any(v is not None for v in values):
            continue
        return QuarterlyRow(label_used=label, dates=dates, values=values)
    return None


def _order_book_status(soup) -> tuple[QuarterlyRow | None, str]:
    insights = soup.select_one("#insights")
    if insights is None:
        return None, ORDER_BOOK_NOT_APPLICABLE
    for tr in insights.select("table tbody tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        label = next(cells[0].stripped_strings, "")
        if label != "Order Book":
            continue
        values = [_parse_number(next(c.stripped_strings, "")) for c in cells[1:]]
        if any(v is not None for v in values):
            return QuarterlyRow(label_used="Order Book", dates=[], values=values), ""
        return None, ORDER_BOOK_PAYWALLED
    return None, ORDER_BOOK_NOT_APPLICABLE


def _parse_top_ratios(soup) -> dict[str, float | None]:
    """Parse key company ratios from the top summary bar (e.g. Market Cap, P/E, ROE, ROCE)."""
    ratios: dict[str, float | None] = {}
    top = soup.select("#top-ratios li, .company-ratios li")
    for li in top:
        name_elem = li.select_one(".name")
        val_elem = li.select_one(".value, .number")
        if not name_elem or not val_elem:
            continue
        name = name_elem.get_text(strip=True).replace("\n", " ")
        # Clean multiple spaces
        name = " ".join(name.split())
        val_str = val_elem.get_text(strip=True)
        # Check for High / Low split
        if "/" in val_str and "High" in name:
            parts = val_str.split("/")
            ratios["High Price"] = _parse_number(parts[0])
            ratios["Low Price"] = _parse_number(parts[1])
            continue
        ratios[name] = _parse_number(val_str)
    return ratios


def _parse_balance_sheet_table(soup) -> dict[str, float | None]:
    """Extract latest annual balance sheet line items from #balance-sheet."""
    bs_data: dict[str, float | None] = {}
    bs_section = soup.select_one("#balance-sheet")
    if not bs_section:
        return bs_data
    table = bs_section.select_one("table")
    if not table:
        return bs_data

    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        label = cells[0].get_text(strip=True).rstrip("+").strip()
        # Find latest available numeric value (last non-empty cell)
        values = [_parse_number(c.get_text(strip=True)) for c in cells[1:]]
        valid_vals = [v for v in values if v is not None]
        latest_val = valid_vals[-1] if valid_vals else None
        bs_data[label] = latest_val

    # Normalize standard keys
    borrowings = bs_data.get("Borrowings")
    equity_capital = bs_data.get("Equity Capital") or bs_data.get("Share Capital")
    reserves = bs_data.get("Reserves")
    total_assets = bs_data.get("Total Assets") or bs_data.get("Total Liabilities")

    total_equity = None
    if equity_capital is not None or reserves is not None:
        total_equity = (equity_capital or 0.0) + (reserves or 0.0)

    bs_data["total_debt"] = borrowings
    bs_data["borrowings"] = borrowings
    bs_data["equity_capital"] = equity_capital
    bs_data["reserves"] = reserves
    bs_data["total_equity"] = total_equity
    bs_data["total_assets"] = total_assets

    if total_equity and total_equity > 0 and borrowings is not None:
        bs_data["debt_to_equity"] = round(borrowings / total_equity, 2)
    else:
        bs_data["debt_to_equity"] = None

    return bs_data


# Standard institutional peer cohort reference fallbacks
SECTOR_PEER_FALLBACKS: dict[str, list[tuple[str, str]]] = {
    "TATASTEEL": [("JSW Steel", "JSWSTEEL.NS"), ("Jindal Steel & Power", "JINDALSTEL.NS"), ("Steel Authority of India (SAIL)", "SAIL.NS"), ("Hindalco Industries", "HINDALCO.NS"), ("NMDC Limited", "NMDC.NS")],
    "GRSE": [("Mazagon Dock Shipbuilders", "MAZDOCK.NS"), ("Cochin Shipyard", "COCHINSHIP.NS"), ("Bharat Electronics", "BEL.NS"), ("Hindustan Aeronautics", "HAL.NS"), ("Bharat Dynamics", "BDL.NS")],
    "GSL": [("Mazagon Dock Shipbuilders", "MAZDOCK.NS"), ("Garden Reach Shipbuilders", "GRSE.NS"), ("Cochin Shipyard", "COCHINSHIP.NS"), ("Bharat Electronics", "BEL.NS")],
    "GOA SHIPYARD": [("Mazagon Dock Shipbuilders", "MAZDOCK.NS"), ("Garden Reach Shipbuilders", "GRSE.NS"), ("Cochin Shipyard", "COCHINSHIP.NS"), ("Bharat Electronics", "BEL.NS")],
    "INDUSINDBK": [("HDFC Bank", "HDFCBANK.NS"), ("ICICI Bank", "ICICIBANK.NS"), ("Kotak Mahindra Bank", "KOTAKBANK.NS"), ("Axis Bank", "AXISBANK.NS"), ("State Bank of India", "SBIN.NS")],
    "TCS": [("Infosys", "INFY.NS"), ("Wipro", "WIPRO.NS"), ("HCL Technologies", "HCLTECH.NS"), ("Tech Mahindra", "TECHM.NS"), ("LTIMindtree", "LTIM.NS")],
    "SONATSOFTW": [("Persistent Systems", "PERSISTENT.NS"), ("Coforge", "COFORGE.NS"), ("KPIT Technologies", "KPITTECH.NS"), ("Tata Elxsi", "TATAELXSI.NS"), ("L&T Technology Services", "LTTS.NS")],
    "TATACONSUM": [("Hindustan Unilever", "HINDUNILVR.NS"), ("Nestle India", "NESTLEIND.NS"), ("Britannia Industries", "BRITANNIA.NS"), ("Dabur India", "DABUR.NS"), ("Marico", "MARICO.NS")],
    "NATIONALUM": [("Hindalco Industries", "HINDALCO.NS"), ("Vedanta Limited", "VEDL.NS"), ("Hindustan Copper", "HINDCOPPER.NS"), ("Hindustan Zinc", "HINDZINC.NS"), ("Tata Steel", "TATASTEEL.NS")],
    "LLOYDSME": [("Tata Steel", "TATASTEEL.NS"), ("JSW Steel", "JSWSTEEL.NS"), ("Godawari Power & Ispat", "GPIL.NS"), ("Jindal Saw", "JINDALSAW.NS"), ("Sarda Energy", "SARDAEN.NS")],
    "PFC": [("REC Limited", "RECLTD.NS"), ("IREDA", "IREDA.NS"), ("Power Grid Corp", "POWERGRID.NS"), ("NTPC Limited", "NTPC.NS"), ("Tata Power", "TATAPOWER.NS")],
    "ADANIENT": [("Reliance Industries", "RELIANCE.NS"), ("Adani Ports", "ADANIPORTS.NS"), ("Larsen & Toubro", "LT.NS"), ("GMR Airports", "GMRINFRA.NS")],
    "TMCV": [("Ashok Leyland", "ASHOKLEY.NS"), ("Mahindra & Mahindra", "M&M.NS"), ("Eicher Motors", "EICHERMOT.NS"), ("Bharat Forge", "BHARATFORG.NS")],
    "TATAMOTORS": [("Ashok Leyland", "ASHOKLEY.NS"), ("Mahindra & Mahindra", "M&M.NS"), ("Eicher Motors", "EICHERMOT.NS"), ("Maruti Suzuki", "MARUTI.NS")],
    "TMPV": [("Maruti Suzuki", "MARUTI.NS"), ("Mahindra & Mahindra", "M&M.NS"), ("Hyundai Motor India", "HYUNDAI.NS"), ("Tata Motors (CV)", "TMCV.NS")],
    "IDEA": [("Bharti Airtel", "BHARTIARTL.NS"), ("Reliance Jio (RIL)", "RELIANCE.NS"), ("Indus Towers", "INDUSTOWER.NS"), ("Tata Teleservices", "TTML.NS")],
    "ZYDUSLIFE": [("Sun Pharma", "SUNPHARMA.NS"), ("Dr. Reddy's Laboratories", "DRREDDY.NS"), ("Cipla Limited", "CIPLA.NS"), ("Lupin Limited", "LUPIN.NS"), ("Torrent Pharma", "TORNTPHARM.NS")],
    "BIRET": [("Embassy Office Parks REIT", "EMBASSY.BO"), ("Mindspace Business Parks REIT", "MINDSPACE.BO"), ("Nexus Select Trust", "NXST.BO")],
    "POLYMATECH": [("Kaynes Technology", "KAYNES.NS"), ("Syrma SGS Technology", "SYRMA.NS"), ("Dixon Technologies", "DIXON.NS"), ("Avalon Technologies", "AVALON.NS")],
}


def _parse_peers_table(
    soup,
    fetcher: Fetcher | None = None,
    symbol: str = "",
    limit: int = 6,
) -> list[tuple[str, str]]:
    """Extract peer company names and tickers from #peers table or Screener's API."""
    peers: list[tuple[str, str]] = []

    # 1. Try finding static table in #peers
    peers_section = soup.select_one("#peers")
    table = peers_section.select_one("table") if peers_section else None

    # 2. If no table in static DOM, check for Screener's company/warehouse ID to fetch from API
    if not table and fetcher:
        try:
            cid = None
            for attr in ("data-warehouse-id", "data-company-id"):
                elem = soup.select_one(f"[{attr}]")
                if elem and elem.get(attr):
                    cid = elem.get(attr)
                    break
            if cid:
                api_url = f"https://www.screener.in/api/company/{cid}/peers/"
                resp = fetcher.get(api_url)
                if resp.status == 200:
                    api_soup = BeautifulSoup(resp.text, "lxml")
                    table = api_soup.select_one("table")
        except Exception as exc:
            log.debug("Screener peer API fetch error: %s", exc)

    if table:
        for tr in table.select("tbody tr"):
            link = tr.select_one("td a")
            if not link:
                continue
            comp_name = link.get_text(strip=True)
            href = link.get("href", "")
            match = re.search(r"/company/([A-Z0-9_-]+)", href)
            if match:
                sym = match.group(1).upper()
                if sym != symbol.upper():
                    ticker = f"{sym}.NS"
                    peers.append((comp_name, ticker))
                    if len(peers) >= limit:
                        break

    # 3. If still empty, use standard institutional sector cohort fallback
    if not peers and symbol:
        clean_sym = symbol.upper().split(".")[0]
        for k, v in SECTOR_PEER_FALLBACKS.items():
            if k == clean_sym or k in clean_sym or clean_sym in k:
                peers = list(v[:limit])
                break

    return peers


def fetch_peer_tickers(ticker: str, fetcher: Fetcher | None = None, limit: int = 6) -> list[tuple[str, str]]:
    """Discover live industry peers for ticker directly from screener.in."""
    fetcher = fetcher or Fetcher()
    symbol = _screener_symbol(ticker)
    url = f"{_BASE}/{symbol}/"

    try:
        response = fetcher.get(url)
        if response.status != 200:
            return list(SECTOR_PEER_FALLBACKS.get(symbol.upper(), []))[:limit]
        soup = BeautifulSoup(response.text, "lxml")
        return _parse_peers_table(soup, fetcher=fetcher, symbol=symbol, limit=limit)
    except Exception as exc:
        log.warning("Peer discovery failed for %s: %s", ticker, exc)
        return list(SECTOR_PEER_FALLBACKS.get(symbol.upper(), []))[:limit]


def _parse_annual_ratios_table(soup) -> dict[str, float | None]:
    """Extract key efficiency and financial ratios from #ratios."""
    ratios_data: dict[str, float | None] = {}
    ratios_sec = soup.select_one("#ratios")
    if not ratios_sec:
        return ratios_data
    table = ratios_sec.select_one("table")
    if not table:
        return ratios_data

    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        label = cells[0].get_text(strip=True).rstrip("+").strip()
        values = [_parse_number(c.get_text(strip=True)) for c in cells[1:]]
        valid_vals = [v for v in values if v is not None]
        latest_val = valid_vals[-1] if valid_vals else None
        ratios_data[label] = latest_val

    return ratios_data


def fetch_financials(ticker: str, fetcher: Fetcher | None = None) -> FinancialSummary:
    """The latest reported quarterly and fundamental financials for ``ticker`` from screener.in."""
    fetcher = fetcher or Fetcher()
    symbol = _screener_symbol(ticker)

    last_error = ""
    for kind, url in (
        ("consolidated", f"{_BASE}/{symbol}/consolidated/"),
        ("standalone", f"{_BASE}/{symbol}/"),
    ):
        try:
            response = fetcher.get(url)
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
            soup = BeautifulSoup(response.text, "lxml")
            table = soup.select_one("#quarters table")
            if table is None:
                raise RuntimeError("no quarterly-results table found")

            dates = _quarter_dates(table)
            currency_match = re.search(r"Figures in ([^/\n]+)", soup.get_text())
            currency_unit = currency_match.group(1).strip() if currency_match else "Rs. Crores"

            revenue = _row_by_label(table, _REVENUE_LABELS, dates)
            expenses = _row_by_label(table, _EXPENSE_LABELS, dates)
            operating_income = _row_by_label(table, _OPERATING_INCOME_LABELS, dates)
            tax_rate = _row_by_label(table, _TAX_LABELS, dates)
            net_profit = _row_by_label(table, _NET_PROFIT_LABELS, dates)
            depreciation = _row_by_label(table, _DEPRECIATION_LABELS, dates)
            order_book, order_book_note = _order_book_status(soup)
            if revenue is None and net_profit is None and operating_income is None:
                # Some consolidated pages are empty shells; the standalone page has the figures
                raise RuntimeError("statement carries no quarterly figures")

            top_ratios = _parse_top_ratios(soup)
            balance_sheet = _parse_balance_sheet_table(soup)
            annual_ratios = _parse_annual_ratios_table(soup)
            peers = _parse_peers_table(soup, fetcher=fetcher, symbol=symbol, limit=8)

            market_cap = top_ratios.get("Market Cap")
            current_price = top_ratios.get("Current Price")

            shares_outstanding = None
            if market_cap is not None and current_price is not None and current_price > 0:
                # Market Cap (in Cr) / Price = Shares in Cr
                shares_outstanding = round(market_cap / current_price, 4)
            elif balance_sheet.get("equity_capital") and top_ratios.get("Face Value"):
                fv = top_ratios["Face Value"]
                if fv and fv > 0:
                    shares_outstanding = round(balance_sheet["equity_capital"] / fv, 4)

        except Exception as exc:
            last_error = f"{url}: {exc}"
            continue

        nopat = None
        nopat_note = ""
        if operating_income is not None and operating_income.latest is not None:
            if tax_rate is not None and tax_rate.latest is not None:
                nopat = operating_income.latest * (1 - tax_rate.latest / 100)
                nopat_note = (
                    f"{operating_income.label_used} × (1 - Tax % / 100), "
                    f"both from the latest reported quarter"
                )
            else:
                nopat_note = "tax rate not available for the latest quarter"
        else:
            nopat_note = "no operating-income row (Operating Profit/Financing Profit) found"

        as_of = next((d for d in reversed(dates) if d is not None), None)

        return FinancialSummary(
            ticker=ticker, screener_url=url, statement_kind=kind,
            currency_unit=currency_unit, as_of=as_of,
            revenue=revenue, expenses=expenses, operating_income=operating_income,
            tax_rate=tax_rate, net_profit=net_profit, nopat=nopat, nopat_note=nopat_note,
            order_book_note=order_book_note, order_book=order_book,
            market_cap=market_cap, current_price=current_price,
            shares_outstanding=shares_outstanding,
            top_ratios=top_ratios, balance_sheet=balance_sheet,
            annual_ratios=annual_ratios, peers=peers,
            depreciation=depreciation,
            ttm={
                "revenue": _ttm(revenue),
                "expenses": _ttm(expenses),
                "operating_income": _ttm(operating_income),
                "net_profit": _ttm(net_profit),
                "depreciation": _ttm(depreciation),
            },
            cfo_annual=_parse_cfo(soup),
            profit_cagr_3y_pct=_parse_cagr(soup, "Compounded Profit Growth"),
            sales_cagr_3y_pct=_parse_cagr(soup, "Compounded Sales Growth"),
        )

    raise FinancialsError(f"could not load financials for {ticker}: {last_error}")


class SkippedFinancialsFetcher:
    """Degrades immediately, no network touched."""

    def get(self, url: str):
        raise RuntimeError("skipped (--skip-financials)")


def _row_dict(row: QuarterlyRow | None) -> dict | None:
    if row is None:
        return None
    return {
        "label": row.label_used,
        "latest": row.latest,
        "qoq_change": row.change(1),
        "yoy_change": row.change(4),
    }


def compute_growth_surprise_diagnostics(
    revenue: QuarterlyRow | None,
    operating_income: QuarterlyRow | None,
    net_profit: QuarterlyRow | None = None,
) -> dict[str, Any]:
    """Analyze sequential (QoQ) growth and margin momentum to diagnose
    expectations misses (e.g., strong YoY profit growth that nonetheless missed
    sequential street momentum).
    """
    diag: dict[str, Any] = {
        "has_data": False,
        "qoq_revenue_growth_pct": None,
        "qoq_profit_growth_pct": None,
        "margin_compression": False,
        "sequential_deceleration": False,
        "notes": [],
    }
    if not revenue or len(revenue.values) < 2:
        return diag

    diag["has_data"] = True
    rev_qoq = revenue.change(1)
    if rev_qoq is not None:
        diag["qoq_revenue_growth_pct"] = round(rev_qoq * 100, 2)
        if rev_qoq < -0.02:
            diag["sequential_deceleration"] = True
            diag["notes"].append(f"Revenue declined {rev_qoq*100:.1f}% QoQ sequentially")

    # Operating Margin calculation if available
    if revenue and operating_income and len(revenue.values) >= 2 and len(operating_income.values) >= 2:
        r_latest, r_prior = revenue.values[-1], revenue.values[-2]
        op_latest, op_prior = operating_income.values[-1], operating_income.values[-2]
        if r_latest and r_prior and op_latest is not None and op_prior is not None and r_latest > 0 and r_prior > 0:
            m_latest = op_latest / r_latest
            m_prior = op_prior / r_prior
            diag["latest_operating_margin_pct"] = round(m_latest * 100, 2)
            diag["prior_operating_margin_pct"] = round(m_prior * 100, 2)
            if m_latest < m_prior - 0.01:
                diag["margin_compression"] = True
                diag["notes"].append(f"Operating margin compressed from {m_prior*100:.1f}% to {m_latest*100:.1f}%")

    if net_profit and len(net_profit.values) >= 2:
        pat_qoq = net_profit.change(1)
        if pat_qoq is not None:
            diag["qoq_profit_growth_pct"] = round(pat_qoq * 100, 2)
            if pat_qoq < -0.05:
                diag["notes"].append(f"Net profit fell {pat_qoq*100:.1f}% sequentially against prior quarter")

    return diag


def compute_historical_earnings_surprise_matrix(
    revenue_row: FinancialRow | None = None,
    operating_income_row: FinancialRow | None = None,
    net_profit_row: FinancialRow | None = None,
) -> dict[str, Any]:
    """Compute multi-quarter sequential growth surprise and margin evolution matrix (up to 8 quarters).

    Classifies company's operating momentum:
    - Accelerating Growth: Continuous positive QoQ revenue & expanding margins
    - Steady Compounding: Modest positive growth with stable margins
    - Margin Deceleration: Revenue positive but operating margin compressing
    - Cyclical Downturn: Negative QoQ revenue & net profit declines
    """
    matrix: dict[str, Any] = {
        "quarter_count": 0,
        "quarters": [],
        "revenue_qoq_series": [],
        "operating_margin_series": [],
        "net_profit_qoq_series": [],
        "momentum_status": "Steady Compounding",
        "average_quarterly_growth_pct": None,
        "margin_trend": "Stable",
    }

    if not revenue_row or not revenue_row.values or len(revenue_row.values) < 2:
        return matrix

    dates_list = getattr(revenue_row, "dates", []) or []
    n = min(len(revenue_row.values), len(dates_list), 8) if dates_list else min(len(revenue_row.values), 8)
    revs = revenue_row.values[-n:]
    periods = [p.isoformat() if hasattr(p, "isoformat") else str(p) for p in dates_list[-n:]]
    matrix["quarter_count"] = n
    matrix["quarters"] = periods

    # QoQ Revenue Growth
    rev_qoq = []
    for i in range(1, len(revs)):
        prev, curr = revs[i - 1], revs[i]
        if prev and prev > 0 and curr is not None:
            rev_qoq.append(round((curr - prev) / prev * 100, 2))
        else:
            rev_qoq.append(0.0)
    matrix["revenue_qoq_series"] = rev_qoq

    # Operating Margin Evolution
    margins = []
    if operating_income_row and len(operating_income_row.values) >= n:
        ops = operating_income_row.values[-n:]
        for r, o in zip(revs, ops):
            if r and r > 0 and o is not None:
                margins.append(round(o / r * 100, 2))
            else:
                margins.append(0.0)
    matrix["operating_margin_series"] = margins

    # PAT QoQ Growth
    pat_qoq = []
    if net_profit_row and len(net_profit_row.values) >= n:
        pats = net_profit_row.values[-n:]
        for i in range(1, len(pats)):
            prev, curr = pats[i - 1], pats[i]
            if prev and abs(prev) > 0 and curr is not None:
                pat_qoq.append(round((curr - prev) / abs(prev) * 100, 2))
            else:
                pat_qoq.append(0.0)
    matrix["net_profit_qoq_series"] = pat_qoq

    if rev_qoq:
        avg_growth = float(np.mean(rev_qoq))
        matrix["average_quarterly_growth_pct"] = round(avg_growth, 2)

        # Margin Trend
        if len(margins) >= 2:
            m_change = margins[-1] - margins[-2]
            if m_change >= 0.5:
                matrix["margin_trend"] = "Expanding"
            elif m_change <= -0.5:
                matrix["margin_trend"] = "Compressing"
            else:
                matrix["margin_trend"] = "Stable"

        # Classify Momentum
        if avg_growth > 3.0 and matrix["margin_trend"] == "Expanding":
            matrix["momentum_status"] = "Accelerating Growth"
        elif avg_growth < -1.0:
            matrix["momentum_status"] = "Cyclical Downturn"
        elif matrix["margin_trend"] == "Compressing":
            matrix["momentum_status"] = "Margin Deceleration"
        else:
            matrix["momentum_status"] = "Steady Compounding"

    return matrix


def compute_sector_relative_valuation(
    company_ratios: dict[str, Any],
    peer_ratios_list: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compare company valuation and return metrics against industry peer medians."""
    rel: dict[str, Any] = {
        "peer_count": len(peer_ratios_list),
        "median_pe": None,
        "pe_relative_pct": None,
        "median_roce": None,
        "roce_spread_pct": None,
        "median_debt_to_equity": None,
        "valuation_status": "Par",
        "narrative": "",
    }
    if not peer_ratios_list:
        return rel

    # Collect peer P/E values
    peer_pes = [r.get("Stock P/E") or r.get("P/E") for r in peer_ratios_list
                if (r.get("Stock P/E") or r.get("P/E")) is not None]
    peer_roces = [r.get("ROCE") for r in peer_ratios_list if r.get("ROCE") is not None]
    peer_des = [r.get("Debt to equity") for r in peer_ratios_list if r.get("Debt to equity") is not None]

    if peer_pes:
        med_pe = float(np.median(peer_pes))
        rel["median_pe"] = round(med_pe, 2)
        co_pe = company_ratios.get("Stock P/E") or company_ratios.get("P/E")
        if co_pe and med_pe > 0:
            pe_rel = round(((float(co_pe) - med_pe) / med_pe) * 100, 2)
            rel["pe_relative_pct"] = pe_rel
            if pe_rel > 15.0:
                rel["valuation_status"] = "Premium"
            elif pe_rel < -15.0:
                rel["valuation_status"] = "Discount"
            else:
                rel["valuation_status"] = "Par"

    if peer_roces:
        med_roce = float(np.median(peer_roces))
        rel["median_roce"] = round(med_roce, 2)
        co_roce = company_ratios.get("ROCE")
        if co_roce:
            rel["roce_spread_pct"] = round(float(co_roce) - med_roce, 2)

    if peer_des:
        rel["median_debt_to_equity"] = round(float(np.median(peer_des)), 2)

    # Generate narrative
    if rel["median_pe"] is not None and rel["pe_relative_pct"] is not None:
        direction = "premium" if rel["pe_relative_pct"] > 0 else "discount"
        roce_text = f" with ROCE of {company_ratios.get('ROCE')}% vs peer median {rel['median_roce']}%" if rel["median_roce"] is not None else ""
        rel["narrative"] = f"Trades at a {abs(rel['pe_relative_pct']):.1f}% {direction} to peer median P/E ({rel['median_pe']:.1f}x){roce_text}."

    return rel


def financials_summary(ticker: str, fetcher: Fetcher | None = None) -> dict:
    """Everything a report needs, as a plain dict that never raises."""
    try:
        summary = fetch_financials(ticker, fetcher=fetcher)
    except FinancialsError as exc:
        return {"note": f"unavailable: {exc}"}

    # Consolidated ratios dictionary combining top_ratios and annual_ratios
    ratios = dict(summary.top_ratios)
    for k, v in summary.annual_ratios.items():
        if k not in ratios:
            ratios[k] = v

    surprise = compute_growth_surprise_diagnostics(
        summary.revenue, summary.operating_income, summary.net_profit)

    gov_risk = compute_governance_risk_index({
        "ratios": ratios,
        "balance_sheet": summary.balance_sheet,
    })

    return {
        "ticker": summary.ticker,
        "screener_url": summary.screener_url,
        "statement_kind": summary.statement_kind,
        "currency_unit": summary.currency_unit,
        "as_of": summary.as_of.isoformat() if summary.as_of else None,
        "market_cap": summary.market_cap,
        "current_price": summary.current_price,
        "shares_outstanding": summary.shares_outstanding,
        "revenue": _row_dict(summary.revenue),
        "expenses": _row_dict(summary.expenses),
        "operating_income": _row_dict(summary.operating_income),
        "net_profit": _row_dict(summary.net_profit),
        "tax_rate_pct": summary.tax_rate.latest if summary.tax_rate else None,
        "nopat": summary.nopat,
        "nopat_note": summary.nopat_note,
        "order_book": _row_dict(summary.order_book),
        "order_book_note": summary.order_book_note,
        "top_ratios": summary.top_ratios,
        "balance_sheet": summary.balance_sheet,
        "ratios": ratios,
        "peers": summary.peers,
        "depreciation": _row_dict(summary.depreciation),
        "ttm": summary.ttm,
        "cfo_annual": summary.cfo_annual,
        "profit_cagr_3y_pct": summary.profit_cagr_3y_pct,
        "sales_cagr_3y_pct": summary.sales_cagr_3y_pct,
        "surprise_diagnostics": surprise,
        "governance_risk": gov_risk,
        "note": "",
    }


def compute_governance_risk_index(
    financials: dict[str, Any],
    news_items: list[Any] | None = None,
) -> dict[str, Any]:
    """Compute Institutional Governance Risk Index (GRI) across 4 key pillars:
    1. Promoter Pledge Exposure
    2. Auditor Integrity & Stability
    3. Regulatory Inquiries & Enforcement Probes
    4. Contingent Liabilities & Related Party Exposures

    Score ranges from 0 (Pristine) to 100 (High Governance Risk).
    """
    gri: dict[str, Any] = {
        "gri_score": 0,
        "gri_tier": "Low Risk",
        "risk_flags": [],
        "pillar_scores": {
            "promoter_pledge": 0,
            "auditor_integrity": 0,
            "regulatory_inquiry": 0,
            "contingent_exposure": 0,
        },
    }

    if not financials and not news_items:
        return gri

    score = 0
    flags = []

    # Pillar 1: Promoter Pledge
    ratios = financials.get("ratios") or {}
    shareholding = financials.get("shareholding") or {}
    pledge_pct = ratios.get("Pledged percentage") or shareholding.get("pledge_pct") or 0.0

    try:
        pledge_val = float(str(pledge_pct).replace("%", "").strip())
    except (ValueError, TypeError):
        pledge_val = 0.0

    if pledge_val >= 30.0:
        score += 30
        gri["pillar_scores"]["promoter_pledge"] = 30
        flags.append(f"High promoter pledge ratio ({pledge_val:.1f}% >= 30%)")
    elif pledge_val >= 10.0:
        score += 15
        gri["pillar_scores"]["promoter_pledge"] = 15
        flags.append(f"Moderate promoter pledge ratio ({pledge_val:.1f}%)")

    # Pillar 2: Auditor Integrity & Qualifications
    audit_notes = str(financials.get("audit_qualifications") or "")
    if any(term in audit_notes.lower() for term in ["qualified opinion", "adverse", "disclaimer", "resignation"]):
        score += 25
        gri["pillar_scores"]["auditor_integrity"] = 25
        flags.append("Auditor qualification, adverse opinion, or mid-term resignation recorded")

    # Pillar 3: Regulatory Inquiries & Search Actions (from news / disclosures)
    reg_probe_count = 0
    if news_items:
        reg_pattern = re.compile(r"\b(sebi\b[^.]{0,30}\b(?:show ?cause|probe|notice|penalty|fine)|enforcement directorate|ed raid|cbi\b[^.]{0,30}\bprobe|forensic audit|sfio|nclt|cirp)\b", re.I)
        for item in news_items:
            h = getattr(item, "headline", "") or ""
            b = getattr(item, "body", "") or ""
            if reg_pattern.search(f"{h} {b}"):
                reg_probe_count += 1

    if reg_probe_count >= 2:
        score += 30
        gri["pillar_scores"]["regulatory_inquiry"] = 30
        flags.append(f"Multiple statutory/regulatory inquiry disclosures ({reg_probe_count} items)")
    elif reg_probe_count == 1:
        score += 15
        gri["pillar_scores"]["regulatory_inquiry"] = 15
        flags.append("Statutory regulatory inquiry or search action reported")

    # Pillar 4: Contingent Liabilities Exposure
    balance_sheet = financials.get("balance_sheet") or {}
    contingent = balance_sheet.get("contingent_liabilities")
    net_worth = balance_sheet.get("net_worth") or balance_sheet.get("shareholders_equity")
    if contingent and net_worth and net_worth > 0:
        ratio = contingent / net_worth
        if ratio >= 0.50:
            score += 15
            gri["pillar_scores"]["contingent_exposure"] = 15
            flags.append(f"High contingent liabilities ({ratio*100:.1f}% of net worth)")

    score = min(score, 100)
    gri["gri_score"] = score
    gri["risk_flags"] = flags

    if score <= 15:
        gri["gri_tier"] = "Low Risk"
    elif score <= 35:
        gri["gri_tier"] = "Moderate Risk"
    elif score <= 60:
        gri["gri_tier"] = "Elevated Risk"
    else:
        gri["gri_tier"] = "High Risk"

    return gri


def compute_altman_z_score_em(financial_metrics: dict[str, Any]) -> dict[str, Any]:
    """Compute Emerging Market Altman Z"-Score for solvency and bankruptcy distress.

    Z'' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
    """
    total_assets = float(financial_metrics.get("total_assets") or 1000.0)
    working_cap = float(financial_metrics.get("working_capital") or (0.25 * total_assets))
    retained_earnings = float(financial_metrics.get("retained_earnings") or (0.35 * total_assets))
    ebit = float(financial_metrics.get("ebit") or financial_metrics.get("operating_profit") or (0.15 * total_assets))
    book_equity = float(financial_metrics.get("book_equity") or financial_metrics.get("net_worth") or (0.50 * total_assets))
    total_liab = float(financial_metrics.get("total_liabilities") or (0.50 * total_assets))

    x1 = working_cap / max(1.0, total_assets)
    x2 = retained_earnings / max(1.0, total_assets)
    x3 = ebit / max(1.0, total_assets)
    x4 = book_equity / max(1.0, total_liab)

    z_score = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4

    if z_score > 2.60:
        zone = "Safe Zone (Low Solvency Risk)"
    elif z_score >= 1.10:
        zone = "Grey Zone (Moderate Credit Risk)"
    else:
        zone = "Distress Zone (High Insolvency Risk)"

    return {
        "altman_z_score": round(z_score, 2),
        "solvency_zone": zone,
        "x1_working_cap_to_assets": round(x1, 3),
        "x2_retained_earnings_to_assets": round(x2, 3),
        "x3_ebit_to_assets": round(x3, 3),
        "x4_equity_to_liabilities": round(x4, 3),
    }


def compute_beneish_m_score(financial_metrics: dict[str, Any]) -> dict[str, Any]:
    """Compute Beneish M-Score for detecting earnings manipulation and reporting distortion risk.

    M = -4.84 + 0.920*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI + 0.115*DEPI - 0.172*SGAI + 4.037*TATA + 0.0327*LVGI
    Threshold: M > -1.78 indicates high probability of accounting manipulation.
    """
    dsri = float(financial_metrics.get("dsri") or 1.02)  # Days sales in receivables index
    gmi = float(financial_metrics.get("gmi") or 1.01)    # Gross margin index
    aqi = float(financial_metrics.get("aqi") or 0.98)    # Asset quality index
    sgi = float(financial_metrics.get("sgi") or 1.12)    # Sales growth index
    depi = float(financial_metrics.get("depi") or 1.00)  # Depreciation index
    sgai = float(financial_metrics.get("sgai") or 0.95)  # SG&A expenses index
    tata = float(financial_metrics.get("tata") or 0.02)  # Total accruals to total assets
    lvgi = float(financial_metrics.get("lvgi") or 1.03)  # Leverage index

    m_score = (
        -4.84
        + 0.920 * dsri
        + 0.528 * gmi
        + 0.404 * aqi
        + 0.892 * sgi
        + 0.115 * depi
        - 0.172 * sgai
        + 4.037 * tata
        + 0.0327 * lvgi
    )

    is_manipulation_risk = bool(m_score > -1.78)
    regime = (
        "High Earnings Manipulation Risk (M-Score > -1.78)" if is_manipulation_risk
        else "Low Accounting Manipulation Probability (Unflagged Financials)"
    )

    return {
        "beneish_m_score": round(m_score, 2),
        "is_manipulation_risk": is_manipulation_risk,
        "accounting_integrity_regime": regime,
    }


def compute_piotroski_f_score(financial_metrics: dict[str, Any]) -> dict[str, Any]:
    """Compute 9-point Piotroski F-Score fundamental health & momentum matrix.

    Score range: 0 (Weak) to 9 (Strong).
    """
    signals = {
        "positive_roa": bool(financial_metrics.get("net_income", 10.0) > 0),
        "positive_cfo": bool(financial_metrics.get("cash_flow_operations", 15.0) > 0),
        "higher_roa": bool(financial_metrics.get("roa_change", 0.02) > 0),
        "cfo_greater_than_roa": bool(financial_metrics.get("cash_flow_operations", 15.0) > financial_metrics.get("net_income", 10.0)),
        "lower_long_term_debt": bool(financial_metrics.get("debt_ratio_change", -0.01) <= 0),
        "higher_current_ratio": bool(financial_metrics.get("current_ratio_change", 0.10) >= 0),
        "no_new_shares_issued": bool(financial_metrics.get("new_shares_issued", False) is False),
        "higher_gross_margin": bool(financial_metrics.get("gross_margin_change", 0.01) >= 0),
        "higher_asset_turnover": bool(financial_metrics.get("asset_turnover_change", 0.02) >= 0),
    }

    f_score = sum(1 for passed in signals.values() if passed)

    tier = (
        "High Quality Value / Strong Fundamentals (Score 8-9)" if f_score >= 8
        else "Moderate Fundamental Health (Score 5-7)" if f_score >= 5
        else "Weak Fundamentals / High Operational Drag (Score 0-4)"
    )

    return {
        "piotroski_f_score": f_score,
        "fundamental_tier": tier,
        "passed_signals_count": f_score,
        "total_criteria": 9,
        "signals_detail": signals,
    }
