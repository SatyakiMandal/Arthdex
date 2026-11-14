"""
Mutual fund scheme list, NAVs and returns from AMFI's own files.

Two official downloads feed it: the daily ``NAVAll.txt`` (every scheme's latest NAV) and
the NAV history report (every scheme's NAV on a past date). Returns are the change between
the two for growth options only: an IDCW option's NAV falls when it pays out, so a return
computed from it would be wrong.

Not available from AMFI's files, and therefore not shown: assets under management, expense
ratios, risk ratios and portfolio holdings (so there is no overlap tool).

``parse`` and ``attach_returns`` are pure and tested offline.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, Callable

CURRENT_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"
HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt={start}&todt={end}"
HISTORY_WINDOW_DAYS = 6  # a past date may be a holiday; take the last NAV in the week before it
PERIODS: list[tuple[str, int]] = [("return1yPct", 1), ("cagr3yPct", 3), ("cagr5yPct", 5)]
STALE_AFTER_DAYS = 10    # a scheme whose NAV is older than this is wound up or suspended

UNAVAILABLE = {
    "aum": "Assets under management are published monthly by each AMC, not in AMFI's NAV files.",
    "expenseRatio": "Expense ratios are disclosed by each AMC and are not in AMFI's NAV files.",
    "riskRatios": "Sharpe and Sortino ratios are not computed: they need each scheme's full NAV history.",
    "holdings": "Portfolio holdings come from each AMC's monthly disclosure, so there is no overlap tool.",
}

_SECTION = re.compile(r"^(Open Ended|Close Ended|Interval Fund)\s*Schemes?\s*\(\s*(.+?)\s*\)\s*$", re.I)


class FundDataUnavailable(Exception):
    """AMFI's NAV file could not be fetched or read."""


def _category(text: str) -> tuple[str, str]:
    """'Equity Scheme - Large Cap Fund' -> ('Equity', 'Large Cap Fund')."""
    head, _, sub = text.partition(" - ")
    head = re.sub(r"\s*\*+\s*", " ", head).strip()
    head = re.sub(r"\s+Schemes?$", "", head, flags=re.I).strip() or head
    return head, sub.strip() or head


def _date(text: str) -> date | None:
    for fmt in ("%d-%b-%Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse(text: str) -> list[dict[str, Any]]:
    """Schemes from either AMFI file. Column positions are read from the header, which differs between the two."""
    lines = text.splitlines()
    header = next((ln for ln in lines if ln.lower().startswith("scheme code")), None)
    if header is None:
        raise ValueError("AMFI file has no 'Scheme Code' header")
    columns = [c.strip().lower() for c in header.split(";")]

    def col(*names: str) -> int:
        for name in names:
            if name in columns:
                return columns.index(name)
        raise ValueError(f"AMFI file is missing a column: {names[0]}")

    i_code, i_name = col("scheme code"), col("scheme name", "nav name")
    i_nav, i_date = col("net asset value"), col("date")
    i_plan = columns.index("plan") if "plan" in columns else None
    i_option = columns.index("option") if "option" in columns else None

    schemes: list[dict[str, Any]] = []
    structure, category, sub, amc = "", "", "", ""
    for raw in lines:
        line = raw.strip()
        if not line or line.lower().startswith("scheme code"):
            continue
        if ";" not in line:
            match = _SECTION.match(line)
            if match:
                structure = match.group(1).title()
                category, sub = _category(match.group(2))
            else:
                amc = line  # a fund house heading
            continue
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < len(columns) or not parts[i_code].isdigit():
            continue
        try:
            nav = float(parts[i_nav].replace(",", ""))
        except ValueError:
            continue  # "N.A." and similar
        nav_date = _date(parts[i_date])
        if nav <= 0 or nav_date is None:
            continue
        name = parts[i_name]
        plan = (parts[i_plan] if i_plan is not None else "") or ("Direct Plan" if re.search(r"\bdirect\b", name, re.I) else "Regular Plan")
        option = (parts[i_option] if i_option is not None else "") or ("Growth Option" if re.search(r"\bgrowth\b", name, re.I) else "IDCW Option")
        schemes.append({
            "schemeCode": parts[i_code],
            "schemeName": name,
            "amc": amc,
            "structure": structure,
            "category": category,
            "subCategory": sub,
            "plan": "Direct" if "direct" in plan.lower() else "Regular",
            "option": "Growth" if "growth" in option.lower() else "IDCW",
            "nav": nav,
            "navDate": nav_date.isoformat(),
        })
    return schemes


def _annualised(now: float, then: float, years: int) -> float:
    return ((now / then) ** (1.0 / years) - 1.0) * 100.0


def attach_returns(schemes: list[dict[str, Any]], past: dict[str, dict[str, tuple[float, date]]]) -> None:
    """
    Adds a return for each period in place. ``past`` maps a period key to
    {schemeCode: (nav, date)}. Growth options only; anything else stays None.
    """
    for scheme in schemes:
        for key, years in PERIODS:
            scheme[key] = None
            then = (past.get(key) or {}).get(scheme["schemeCode"])
            if scheme["option"] != "Growth" or not then or then[0] <= 0:
                continue
            scheme[key] = round(_annualised(scheme["nav"], then[0], years), 2)


def screen(
    schemes: list[dict[str, Any]],
    category: str | None = None,
    sub_category: str | None = None,
    amc: str | None = None,
    plan: str | None = None,
    option: str | None = None,
    query: str | None = None,
    sort: str = "schemeName",
    limit: int = 100,
) -> list[dict[str, Any]]:
    def same(value: str, wanted: str | None) -> bool:
        return not wanted or wanted.lower() in ("all", "") or value.lower() == wanted.lower()

    q = (query or "").strip().lower()
    out = [
        s for s in schemes
        if same(s["category"], category) and same(s["subCategory"], sub_category) and same(s["plan"], plan)
        and same(s["option"], option) and (not amc or amc.lower() in ("all", "") or amc.lower() in s["amc"].lower())
        and (not q or q in s["schemeName"].lower() or q in s["amc"].lower() or q == s["schemeCode"])
    ]
    if sort in ("return1yPct", "cagr3yPct", "cagr5yPct"):
        out.sort(key=lambda s: (s.get(sort) is not None, s.get(sort) or 0.0), reverse=True)
    else:
        out.sort(key=lambda s: s["schemeName"].lower())
    return out[:limit]


def _history_window(target: date) -> str:
    start = target - timedelta(days=HISTORY_WINDOW_DAYS)
    return HISTORY_URL.format(start=start.strftime("%d-%b-%Y"), end=target.strftime("%d-%b-%Y"))


def build(get_text: Callable[[str], str], today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    try:
        schemes = parse(get_text(CURRENT_URL))
    except Exception as exc:
        raise FundDataUnavailable(f"AMFI's NAV file could not be read: {exc}") from exc
    if not schemes:
        raise FundDataUnavailable("AMFI's NAV file listed no schemes")

    latest = max(date.fromisoformat(s["navDate"]) for s in schemes)
    schemes = [s for s in schemes if (latest - date.fromisoformat(s["navDate"])).days <= STALE_AFTER_DAYS]

    past: dict[str, dict[str, tuple[float, date]]] = {}
    missing_periods: list[str] = []
    for key, years in PERIODS:
        try:
            target = latest.replace(year=latest.year - years)
        except ValueError:  # 29 February
            target = latest.replace(year=latest.year - years, day=28)
        try:
            rows = parse(get_text(_history_window(target)))
        except Exception:
            missing_periods.append(key)
            continue
        table: dict[str, tuple[float, date]] = {}
        for row in rows:
            day = date.fromisoformat(row["navDate"])
            if row["schemeCode"] not in table or day > table[row["schemeCode"]][1]:
                table[row["schemeCode"]] = (row["nav"], day)
        past[key] = table
    attach_returns(schemes, past)

    categories: dict[str, set[str]] = {}
    for s in schemes:
        categories.setdefault(s["category"], set()).add(s["subCategory"])
    return {
        "asOf": latest.isoformat(),
        "totalSchemes": len(schemes),
        "schemes": schemes,
        "categories": {name: sorted(subs) for name, subs in sorted(categories.items())},
        "amcs": sorted({s["amc"] for s in schemes if s["amc"]}),
        "returnsMissingFor": missing_periods,
        "unavailable": UNAVAILABLE,
    }


def fetch() -> dict[str, Any]:
    import requests

    def get_text(url: str) -> str:
        response = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        response.encoding = "utf-8"  # AMFI sends no charset; the files are UTF-8
        return response.text

    return build(get_text)
