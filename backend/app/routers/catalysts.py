"""
Corporate catalysts: refused until each has a real source.

The index-rebalance desk assigned invented inclusion probabilities, the buyback desk
used invented acceptance ratios and the lock-in calendar fixed share counts. Each needs
exchange data Arthdex does not fetch yet, so the endpoints say so.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..not_sourced import refuse

router = APIRouter(prefix="/api/v1/catalysts", tags=["catalysts"])


@router.get("/index-rebalance")
def get_index_rebalance():
    refuse("Index rebalance candidates", "free-float market caps and turnover for the index review window", "NSE Indices publishes the methodology but no free-float feed")


@router.get("/ipo-lockins")
def get_ipo_lockins():
    refuse("IPO lock-in expiries", "each issue's lock-in schedule and locked share counts", "they are in each offer document, which is not parsed yet")


@router.get("/buybacks")
def get_buybacks():
    refuse("Buyback arbitrage", "open buyback offers with entitlement and acceptance ratios", "they are in each offer letter, which is not parsed yet")
