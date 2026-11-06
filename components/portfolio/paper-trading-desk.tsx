"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Send,
  Zap,
  Lock,
  ExternalLink,
} from "lucide-react";
import type {
  ApiPaperAccountResponse,
  ApiPaperOrder,
  ApiPaperPosition,
  ApiRegulatoryCharges,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface PaperTradingDeskProps {
  initialData: ApiPaperAccountResponse;
}

export function PaperTradingDesk({ initialData }: PaperTradingDeskProps) {
  const [account, setAccount] = useState<ApiPaperAccountResponse>(initialData);
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "emsx">("positions");

  useEffect(() => {
    queueMicrotask(() => {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        if (p.get("tab") === "emsx") {
          setActiveTab("emsx");
        }
      }
    });
  }, []);

  // Order ticket state
  const [symbol, setSymbol] = useState<string>("RELIANCE");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [product, setProduct] = useState<"CNC" | "MIS">("CNC");
  const [quantity, setQuantity] = useState<number>(50);
  const [price, setPrice] = useState<number>(1325.0);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // Live regulatory charges calculation
  const charges: ApiRegulatoryCharges = useMemo(() => {
    const tradeValue = quantity * price;
    const brokerage = Math.min(20.0, Math.round(tradeValue * 0.0003 * 100) / 100);

    const stt =
      product === "CNC"
        ? Math.round(tradeValue * 0.001 * 100) / 100
        : action === "SELL"
        ? Math.round(tradeValue * 0.00025 * 100) / 100
        : 0.0;

    const exchangeTurnover = Math.round(tradeValue * 0.0000297 * 100) / 100;
    const stampDuty = action === "BUY" ? Math.round(tradeValue * 0.00015 * 100) / 100 : 0.0;
    const sebiCharges = Math.round(tradeValue * 0.000001 * 100) / 100;

    const gst = Math.round((brokerage + exchangeTurnover + sebiCharges) * 0.18 * 100) / 100;
    const totalCharges = Math.round((brokerage + stt + exchangeTurnover + stampDuty + sebiCharges + gst) * 100) / 100;

    const netCashFlow = action === "BUY" ? -(tradeValue + totalCharges) : tradeValue - totalCharges;

    return {
      tradeValue: Math.round(tradeValue * 100) / 100,
      brokerage,
      stt,
      exchangeTurnover,
      stampDuty,
      sebiCharges,
      gst,
      totalCharges,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      breakevenBps: tradeValue > 0 ? Math.round((totalCharges / tradeValue) * 10000 * 10) / 10 : 0.0,
    };
  }, [quantity, price, action, product]);

  // Execute Virtual Order client-side
  const handleExecuteOrder = () => {
    setExecutionMessage(null);
    const tradeVal = quantity * price;

    if (action === "BUY") {
      const required = tradeVal + charges.totalCharges;
      if (required > account.cashBalance) {
        setExecutionMessage(`Insufficient virtual cash balance. Required: ₹${required.toLocaleString("en-IN")}`);
        return;
      }

      const updatedCash = account.cashBalance - required;
      const updatedPositions = [...account.positions];
      const existingPos = updatedPositions.find((p) => p.symbol === symbol && p.product === product);

      if (existingPos) {
        const newQty = existingPos.quantity + quantity;
        const newInvested = existingPos.investedValue + tradeVal;
        existingPos.quantity = newQty;
        existingPos.investedValue = newInvested;
        existingPos.averagePrice = Math.round((newInvested / newQty) * 100) / 100;
        existingPos.currentValue = Math.round(newQty * price * 100) / 100;
        existingPos.unrealizedPnl = Math.round((existingPos.currentValue - newInvested) * 100) / 100;
        existingPos.unrealizedPnlPct = Math.round((existingPos.unrealizedPnl / newInvested) * 10000) / 100;
      } else {
        updatedPositions.push({
          symbol,
          name: `${symbol} Equity`,
          quantity,
          product,
          averagePrice: price,
          cmp: price,
          investedValue: tradeVal,
          currentValue: tradeVal,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          dayChangePct: 0.5,
        });
      }

      const newOrder: ApiPaperOrder = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        symbol,
        action,
        product,
        quantity,
        price,
        tradeValue: tradeVal,
        totalCharges: charges.totalCharges,
        status: "FILLED",
        timestamp: new Date().toISOString(),
      };

      const updatedAccount: ApiPaperAccountResponse = {
        ...account,
        cashBalance: updatedCash,
        positions: updatedPositions,
        orders: [newOrder, ...account.orders],
      };
      setAccount(updatedAccount);
      setExecutionMessage(`BUY ${quantity} ${symbol} @ ₹${price} filled successfully!`);
    } else {
      // SELL
      const existingPos = account.positions.find((p) => p.symbol === symbol && p.product === product);
      if (!existingPos || existingPos.quantity < quantity) {
        setExecutionMessage(`Insufficient shares to sell. Available: ${existingPos ? existingPos.quantity : 0}`);
        return;
      }

      const netReceived = tradeVal - charges.totalCharges;
      const updatedCash = account.cashBalance + netReceived;
      const pnl = tradeVal - existingPos.averagePrice * quantity;
      const updatedRealized = account.realizedPnl + pnl;

      let updatedPositions = [...account.positions];
      if (existingPos.quantity === quantity) {
        updatedPositions = updatedPositions.filter((p) => !(p.symbol === symbol && p.product === product));
      } else {
        existingPos.quantity -= quantity;
        existingPos.investedValue = existingPos.quantity * existingPos.averagePrice;
        existingPos.currentValue = existingPos.quantity * price;
        existingPos.unrealizedPnl = existingPos.currentValue - existingPos.investedValue;
      }

      const newOrder: ApiPaperOrder = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        symbol,
        action,
        product,
        quantity,
        price,
        tradeValue: tradeVal,
        totalCharges: charges.totalCharges,
        status: "FILLED",
        timestamp: new Date().toISOString(),
      };

      const updatedAccount: ApiPaperAccountResponse = {
        ...account,
        cashBalance: updatedCash,
        realizedPnl: updatedRealized,
        positions: updatedPositions,
        orders: [newOrder, ...account.orders],
      };
      setAccount(updatedAccount);
      setExecutionMessage(`SELL ${quantity} ${symbol} @ ₹${price} filled! Realized P&L: ₹${Math.round(pnl).toLocaleString("en-IN")}`);
    }
  };

  const totalCurrentHoldings = account.positions.reduce((acc, p) => acc + p.currentValue, 0);
  const totalInvestedHoldings = account.positions.reduce((acc, p) => acc + p.investedValue, 0);
  const totalUnrealized = totalCurrentHoldings - totalInvestedHoldings;
  const netPortfolioValue = account.cashBalance + totalCurrentHoldings;

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            PAPR &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Virtual Execution Simulator &amp; Statutory Cost Engine (EMSX)
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Receipt className="h-3 w-3 text-cyan-400" />
            STT · GST · Stamp Duty · Exchange Fees
          </span>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span>PORTFOLIO VALUE: <strong className="text-foreground">₹{Math.round(netPortfolioValue).toLocaleString("en-IN")}</strong></span>
        </div>
      </div>

      {/* 2. Executive Headline Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Card 1: Virtual Cash */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Available Cash Balance</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              ₹{Math.round(account.cashBalance).toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">Free Margin</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Initial: ₹10,00,000</div>
        </div>

        {/* Card 2: Equity Margin Utilized */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Holdings Market Value</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 tabular-nums">
              ₹{Math.round(totalCurrentHoldings).toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">Invested</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            {account.positions.length} Active Positions
          </div>
        </div>

        {/* Card 3: Unrealized P&L */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Unrealized P&amp;L</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                totalUnrealized >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {totalUnrealized >= 0 ? "+" : ""}₹{Math.round(totalUnrealized).toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">Open MTM</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Mark-to-market</div>
        </div>

        {/* Card 4: Realized P&L */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Realized P&amp;L</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                account.realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {account.realizedPnl >= 0 ? "+" : ""}₹{Math.round(account.realizedPnl).toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">Closed Trades</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Post-statutory charges</div>
        </div>
      </div>

      {/* 3. Execution & Ledger Workbench (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Left Column: Order Ticket & Contract Note Calculator (1 Col) */}
        <div className="border border-border bg-card/80 p-2.5 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide flex items-center justify-between">
            <span>ORDER PLACEMENT TICKET</span>
            <span className="text-cyan-400">NSE CASH SEGMENT</span>
          </div>

          {/* Execution Alert Message */}
          {executionMessage && (
            <div
              className={cn(
                "p-1.5 text-3xs border",
                executionMessage.includes("Insufficient")
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              )}
            >
              {executionMessage}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-2 text-2xs">
            {/* Symbol & Side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-3xs uppercase text-muted-foreground">SYMBOL</label>
                <select
                  value={symbol}
                  onChange={(e) => {
                    const sym = e.target.value;
                    setSymbol(sym);
                    if (sym === "RELIANCE") setPrice(1325.0);
                    else if (sym === "TCS") setPrice(4148.0);
                    else if (sym === "HDFCBANK") setPrice(1728.0);
                    else if (sym === "INFY") setPrice(1850.0);
                    else if (sym === "ICICIBANK") setPrice(1280.0);
                  }}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
                >
                  <option value="RELIANCE">RELIANCE (₹1,325.0)</option>
                  <option value="TCS">TCS (₹4,148.0)</option>
                  <option value="HDFCBANK">HDFCBANK (₹1,728.0)</option>
                  <option value="INFY">INFY (₹1,850.0)</option>
                  <option value="ICICIBANK">ICICIBANK (₹1,280.0)</option>
                </select>
              </div>

              <div>
                <label className="text-3xs uppercase text-muted-foreground">ORDER SIDE</label>
                <div className="grid grid-cols-2 gap-1 mt-0.5">
                  <button
                    onClick={() => setAction("BUY")}
                    className={cn(
                      "py-1 text-3xs font-bold uppercase border transition-colors",
                      action === "BUY"
                        ? "bg-emerald-500 text-black border-emerald-500"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setAction("SELL")}
                    className={cn(
                      "py-1 text-3xs font-bold uppercase border transition-colors",
                      action === "SELL"
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Product & Qty */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-3xs uppercase text-muted-foreground">PRODUCT</label>
                <div className="grid grid-cols-2 gap-1 mt-0.5">
                  <button
                    onClick={() => setProduct("CNC")}
                    className={cn(
                      "py-1 text-3xs font-bold uppercase border transition-colors",
                      product === "CNC"
                        ? "bg-foreground text-background border-foreground"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    CNC (Delivery)
                  </button>
                  <button
                    onClick={() => setProduct("MIS")}
                    className={cn(
                      "py-1 text-3xs font-bold uppercase border transition-colors",
                      product === "MIS"
                        ? "bg-foreground text-background border-foreground"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    MIS (Intraday)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-3xs uppercase text-muted-foreground">QUANTITY</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Execution Price */}
            <div>
              <label className="text-3xs uppercase text-muted-foreground">LIMIT / FILL PRICE (₹)</label>
              <input
                type="number"
                step="0.05"
                value={price}
                onChange={(e) => setPrice(Math.max(0.05, parseFloat(e.target.value) || 0))}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Statutory Contract Note Breakdown */}
          <div className="border border-border/80 bg-muted/20 p-2 space-y-1 text-3xs">
            <div className="font-bold text-foreground border-b border-border/60 pb-0.5 uppercase tracking-wide">
              CONTRACT NOTE CHARGES BREAKDOWN
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trade Turnover:</span>
              <span className="font-mono text-foreground">₹{charges.tradeValue.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Brokerage:</span>
              <span className="font-mono text-foreground">₹{charges.brokerage.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">STT / CTT ({product === "CNC" ? "0.1%" : "0.025%"}):</span>
              <span className="font-mono text-foreground">₹{charges.stt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exchange Turnover &amp; SEBI:</span>
              <span className="font-mono text-foreground">
                ₹{(charges.exchangeTurnover + charges.sebiCharges).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stamp Duty ({action === "BUY" ? "0.015%" : "0%"}):</span>
              <span className="font-mono text-foreground">₹{charges.stampDuty.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (18% on fees):</span>
              <span className="font-mono text-foreground">₹{charges.gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-1 font-bold">
              <span className="text-amber-400">Total Statutory Taxes:</span>
              <span className="font-mono text-amber-400">₹{charges.totalCharges.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xs font-bold border-t border-border pt-1">
              <span className="text-foreground">Net Cash Flow:</span>
              <span
                className={cn(
                  "font-mono",
                  charges.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                ₹{Math.abs(charges.netCashFlow).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-3xs text-muted-foreground pt-0.5">
              Breakeven: +{charges.breakevenBps} bps required to cover taxes
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handleExecuteOrder}
            className="w-full py-2 text-xs font-bold uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            EXECUTE VIRTUAL TRADE &lt;GO&gt;
          </button>
        </div>

        {/* Right Column: Positions & Orders Tables (2 Cols) */}
        <div className="lg:col-span-2 border border-border bg-card/60 p-2 space-y-2">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("positions")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
                  activeTab === "positions"
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                Open Positions ({account.positions.length})
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
                  activeTab === "orders"
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                Order Book &amp; Fills ({account.orders.length})
              </button>
              <button
                onClick={() => setActiveTab("emsx")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
                  activeTab === "emsx"
                    ? "bg-accent text-accent-foreground border-accent font-bold"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:border-accent/40"
                )}
              >
                EMSX: Live Broker Gateway
              </button>
            </div>
          </div>

          {/* Tab 1: Positions Table */}
          {activeTab === "positions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-2xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Product</th>
                    <th className="py-1 px-2 text-right">Quantity</th>
                    <th className="py-1 px-2 text-right">Avg Price (₹)</th>
                    <th className="py-1 px-2 text-right">CMP (₹)</th>
                    <th className="py-1 px-2 text-right">Invested Value</th>
                    <th className="py-1 px-2 text-right">Current Value</th>
                    <th className="py-1 px-2 text-right">Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {account.positions.map((pos) => (
                    <tr key={`${pos.symbol}-${pos.product}`} className="hover:bg-muted/40 transition-colors">
                      <td className="py-1.5 px-2 font-bold text-foreground">
                        {pos.symbol}
                      </td>
                      <td className="py-1.5 px-2 text-3xs text-muted-foreground">
                        <span className="px-1 py-0.2 border border-border bg-muted/20">
                          {pos.product}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right text-foreground tabular-nums">
                        {pos.quantity}
                      </td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">
                        ₹{pos.averagePrice.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-foreground tabular-nums">
                        ₹{pos.cmp.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">
                        ₹{pos.investedValue.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 px-2 text-right text-foreground font-semibold tabular-nums">
                        ₹{pos.currentValue.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-bold tabular-nums",
                          pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {pos.unrealizedPnl >= 0 ? "+" : ""}₹{pos.unrealizedPnl.toLocaleString("en-IN")}
                        <span className="text-3xs block font-normal">
                          ({pos.unrealizedPnlPct >= 0 ? "+" : ""}{pos.unrealizedPnlPct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Orders Table */}
          {activeTab === "orders" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-2xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-1 px-2">Order ID</th>
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Side</th>
                    <th className="py-1 px-2">Product</th>
                    <th className="py-1 px-2 text-right">Qty</th>
                    <th className="py-1 px-2 text-right">Price (₹)</th>
                    <th className="py-1 px-2 text-right">Value (₹)</th>
                    <th className="py-1 px-2 text-right">Statutory Taxes</th>
                    <th className="py-1 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {account.orders.map((ord) => (
                    <tr key={ord.orderId} className="hover:bg-muted/40 transition-colors">
                      <td className="py-1.5 px-2 text-3xs text-muted-foreground">{ord.orderId}</td>
                      <td className="py-1.5 px-2 font-bold text-foreground">{ord.symbol}</td>
                      <td className="py-1.5 px-2">
                        <span
                          className={cn(
                            "px-1 py-0.2 text-3xs font-bold border",
                            ord.action === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          )}
                        >
                          {ord.action}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-3xs text-muted-foreground">{ord.product}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{ord.quantity}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">₹{ord.price.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        ₹{ord.tradeValue.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 px-2 text-right text-amber-400 tabular-nums">
                        ₹{ord.totalCharges.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span className="text-3xs font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 border border-emerald-500/30">
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: EMSX Live Broker Gateway */}
          {activeTab === "emsx" && (
            <div className="space-y-3 p-2 font-mono text-2xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-bold text-foreground uppercase">
                  EMSX: LIVE BROKER ORDER ROUTING &amp; DISPATCH (M27)
                </span>
                <span className="text-3xs text-accent font-bold">SEBI AUDIT TAG: ARTHDEX_ALGO</span>
              </div>

              {/* Supported Indian Brokers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: "Zerodha Kite Connect", auth: "API Key + Request Token", status: "SIMULATED LIVE", ping: "14ms", desc: "NSE Equity & F&O Direct Market Access" },
                  { name: "Upstox Pro API v2", auth: "OAuth 2.0 Access Token", status: "CONNECTED", ping: "22ms", desc: "NSE Cash & Currencies Router" },
                  { name: "Angel One SmartAPI", auth: "TOTP 2FA + JWT Token", status: "READY", ping: "18ms", desc: "Multi-exchange Basket Orders" },
                  { name: "Groww Execution", auth: "Direct Broker Connect", status: "READY", ping: "28ms", desc: "Instant Delivery Cash Orders" },
                ].map((broker) => (
                  <div key={broker.name} className="p-2.5 border border-border bg-surface-muted/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase">{broker.name}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {broker.status}
                      </span>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-1">{broker.desc}</p>
                    <div className="flex justify-between items-center text-3xs text-muted-foreground pt-1.5 border-t border-border/40 mt-2">
                      <span>Auth: {broker.auth}</span>
                      <span className="text-accent">{broker.ping}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Multi-Leg Basket Dispatcher */}
              <div className="p-3 border border-border bg-surface space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1">
                  <span className="font-bold text-3xs uppercase text-foreground">Multi-Order Basket Dispatch</span>
                  <span className="text-3xs text-muted-foreground">Pre-Trade Risk Checks: PASS</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-3xs">
                  <div className="p-1.5 border border-border/60 bg-surface-muted/20">
                    <span className="text-muted-foreground">Leg 1:</span>
                    <div className="font-bold text-foreground">BUY 100 RELIANCE @ CMP</div>
                  </div>
                  <div className="p-1.5 border border-border/60 bg-surface-muted/20">
                    <span className="text-muted-foreground">Leg 2:</span>
                    <div className="font-bold text-foreground">BUY 50 TCS @ CMP</div>
                  </div>
                  <div className="p-1.5 border border-border/60 bg-surface-muted/20">
                    <span className="text-muted-foreground">Leg 3:</span>
                    <div className="font-bold text-foreground">BUY 150 HDFCBANK @ CMP</div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-3xs text-muted-foreground">
                    Pre-trade margin validated. Orders tagged with unique client code (UCC).
                  </span>
                  <button
                    type="button"
                    onClick={() => alert("Simulated 3-leg basket dispatched to connected broker gateway with audit tag ARTHDEX_ALGO.")}
                    className="px-3 py-1.5 bg-accent text-accent-foreground font-bold text-3xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
                  >
                    DISPATCH BASKET TO BROKER &lt;GO&gt;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED EXECUTION DESKS:</span>
          <Link href="/portfolio" className="text-cyan-400 hover:underline">
            PORT &lt;GO&gt; (Portfolio Terminal)
          </Link>
          <Link href="/strategy-builder" className="text-cyan-400 hover:underline">
            OSB &lt;GO&gt; (Options Strategy)
          </Link>
          <Link href="/bhavcopy" className="text-cyan-400 hover:underline">
            BHAV &lt;GO&gt; (Daily Bhavcopy)
          </Link>
          <Link href="/live" className="text-cyan-400 hover:underline">
            LIVE &lt;GO&gt; (Market Cockpit)
          </Link>
        </div>

        <div>
          <span>Virtual execution with authentic Indian regulatory cost models</span>
        </div>
      </div>
    </div>
  );
}
