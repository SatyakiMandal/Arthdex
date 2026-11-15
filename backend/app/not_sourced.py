"""
Desks that have no real data source refuse, rather than show invented figures.

Every such endpoint answers 503 with a plain sentence: what the desk would need and
where that data lives. The front end shows the sentence as it is. A desk comes back
only when a fetcher for a real source is written for it.
"""

from __future__ import annotations

from typing import NoReturn

from fastapi import HTTPException


def refuse(desk: str, needs: str, where: str) -> NoReturn:
    raise HTTPException(
        status_code=503,
        detail=f"{desk} is not shown: it needs {needs}, and Arthdex has no feed for that yet ({where}). No figures are shown in its place.",
    )
