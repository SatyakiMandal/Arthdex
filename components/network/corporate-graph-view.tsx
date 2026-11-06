"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  Building2,
  Layers,
  ShieldAlert,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  CheckCircle2,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  ApiCorporateHierarchy,
  ApiSupplyChainNetwork,
  ApiNetworkSummary,
  ApiSupplyChainSupplier,
  ApiSupplyChainCustomer,
  ApiHoldingEntity,
  ApiSupplyChainContractor,
} from "@/lib/api/types";
import { NodeDossierDrawer, SelectedNodeData } from "./node-dossier-drawer";

interface CorporateGraphViewProps {
  initialSymbol: string;
  initialHierarchy: ApiCorporateHierarchy;
  initialSupplyChain: ApiSupplyChainNetwork;
  initialSummary: ApiNetworkSummary;
  initialMode?: "SPLC" | "HOLD";
}

export function CorporateGraphView({
  initialSymbol,
  initialHierarchy,
  initialSupplyChain,
  initialSummary,
  initialMode = "SPLC",
}: CorporateGraphViewProps) {
  const router = useRouter();
  const [symbolInput, setSymbolInput] = useState(initialSymbol);
  const [activeMode, setActiveMode] = useState<"SPLC" | "HOLD">(initialMode);
  const [activeCluster, setActiveCluster] = useState<string>("ALL");
  const [selectedNode, setSelectedNode] = useState<SelectedNodeData | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleSearchSymbol = (sym: string) => {
    const clean = sym.trim().toUpperCase();
    if (!clean) return;
    router.push(`/network?symbol=${encodeURIComponent(clean)}&mode=${activeMode.toLowerCase()}`);
  };

  // Filter suppliers in SPLC mode
  const filteredSuppliers = useMemo(() => {
    if (activeCluster === "ALL") return initialSupplyChain.suppliers;
    if (activeCluster === "SOLE_SOURCE") {
      return initialSupplyChain.suppliers.filter((s) => s.is_sole_source);
    }
    return initialSupplyChain.suppliers.filter((s) => s.cluster === activeCluster);
  }, [initialSupplyChain.suppliers, activeCluster]);

  // SVG Geometry Calculation (Zero-Jitter Deterministic Node Coordinates)
  const graphLayout = useMemo(() => {
    const width = 1200;
    const height = 650;
    const centerX = width / 2;
    const centerY = height / 2;

    if (activeMode === "SPLC") {
      // SPLC Mode: Left = Suppliers, Center = Target, Right = Customers, Bottom = Contractors
      const suppliers = filteredSuppliers;
      const customers = initialSupplyChain.customers;
      const contractors = initialSupplyChain.independent_contractors;

      // Supplier positions (left arc)
      const supplierNodes = suppliers.map((s, idx) => {
        const total = suppliers.length || 1;
        const step = (height - 120) / Math.max(total, 1);
        const y = 60 + idx * step + step / 2;
        const x = 160 + (idx % 2 === 0 ? 0 : 40);
        return {
          id: `sup-${s.symbol || idx}`,
          x,
          y,
          data: s,
          role: "SUPPLIER" as const,
        };
      });

      // Customer positions (right arc)
      const customerNodes = customers.map((c, idx) => {
        const total = customers.length || 1;
        const step = (height - 120) / Math.max(total, 1);
        const y = 80 + idx * step + step / 2;
        const x = width - 180 - (idx % 2 === 0 ? 0 : 40);
        return {
          id: `cust-${idx}`,
          x,
          y,
          data: c,
          role: "CUSTOMER" as const,
        };
      });

      // Contractor positions (bottom arc)
      const contractorNodes = contractors.map((c, idx) => {
        const total = contractors.length || 1;
        const step = 400 / Math.max(total, 1);
        const x = centerX - 200 + idx * step + step / 2;
        const y = height - 70;
        return {
          id: `cont-${idx}`,
          x,
          y,
          data: c,
          role: "CONTRACTOR" as const,
        };
      });

      return {
        width,
        height,
        centerX,
        centerY,
        targetNode: {
          id: `target-${initialSupplyChain.symbol}`,
          x: centerX,
          y: centerY - 20,
          name: initialSupplyChain.name,
          symbol: initialSupplyChain.symbol,
          role: "TARGET" as const,
        },
        suppliers: supplierNodes,
        customers: customerNodes,
        contractors: contractorNodes,
        subsidiaries: [],
      };
    } else {
      // HOLD Mode: Top = Parent, Bottom = Holding Entities & Subsidiaries
      const subs = initialHierarchy.holding_entities;
      const cols = Math.min(subs.length, 4);
      const rows = Math.ceil(subs.length / cols);

      const subNodes = subs.map((sub, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const colWidth = (width - 240) / Math.max(cols, 1);
        const x = 140 + col * colWidth + colWidth / 2;
        const y = 240 + row * 160;
        return {
          id: `sub-${sub.symbol || idx}`,
          x,
          y,
          data: sub,
          role: "SUBSIDIARY" as const,
        };
      });

      return {
        width,
        height: Math.max(height, 280 + rows * 160),
        centerX,
        centerY: 100,
        targetNode: {
          id: `parent-${initialHierarchy.parent_symbol}`,
          x: centerX,
          y: 90,
          name: initialHierarchy.parent_name,
          symbol: initialHierarchy.parent_symbol,
          role: "TARGET" as const,
        },
        suppliers: [],
        customers: [],
        contractors: [],
        subsidiaries: subNodes,
      };
    }
  }, [activeMode, filteredSuppliers, initialSupplyChain, initialHierarchy]);

  const handleNodeClick = (node: any) => {
    if (node.role === "SUPPLIER") {
      const s = node.data as ApiSupplyChainSupplier;
      setSelectedNode({
        id: node.id,
        name: s.name,
        symbol: s.symbol,
        role: "SUPPLIER",
        tier: s.tier,
        cluster: s.cluster,
        component: s.component,
        dependency_pct: s.dependency_pct,
        cogs_share_pct: s.cogs_share_pct,
        is_sole_source: s.is_sole_source,
        contract_type: s.contract_type,
        origin: s.origin,
        location: s.location,
        provenance: s.provenance,
      });
    } else if (node.role === "SUBSIDIARY") {
      const sub = node.data as ApiHoldingEntity;
      setSelectedNode({
        id: node.id,
        name: sub.name,
        symbol: sub.symbol,
        role: "SUBSIDIARY",
        listing_status: sub.listing_status,
        ownership_pct: sub.ownership_pct,
        revenue_contrib_cr: sub.revenue_contrib_cr,
        ebitda_contrib_pct: sub.ebitda_contrib_pct,
        business_segment: sub.business_segment,
        provenance: sub.provenance,
      });
    } else if (node.role === "CUSTOMER") {
      const c = node.data as ApiSupplyChainCustomer;
      setSelectedNode({
        id: node.id,
        name: c.name,
        symbol: null,
        role: "CUSTOMER",
        channel_type: c.channel_type,
        volume_share_pct: c.volume_share_pct,
        regions: c.regions,
        key_products: c.key_products,
        provenance: c.provenance,
      });
    } else if (node.role === "CONTRACTOR") {
      const ct = node.data as ApiSupplyChainContractor;
      setSelectedNode({
        id: node.id,
        name: ct.name,
        symbol: null,
        role: "CONTRACTOR",
        service_category: ct.service_category,
        scope: ct.scope,
        spend_cr: ct.spend_cr,
        provenance: "ACTUAL FILING",
      });
    }
  };

  return (
    <div className="space-y-2.5 font-mono">
      {/* SEBI Compliance Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-surface-muted/40 p-2.5 rounded-none text-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-accent shrink-0" />
          <span className="font-bold uppercase tracking-wider text-foreground">
            SEBI REGULATORY NOTICE: CORPORATE NETWORK &amp; MULTI-TIER SPLC (M28)
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-3xs">
          <span>RELATED PARTY DISCLOSURES (NOTE 34) • MCA HOLDINGS • ZERO HALLUCINATION</span>
          <span className="border border-up/40 bg-up/10 text-up px-1.5 py-0.5 font-bold uppercase">
            [ACTUAL FILING]
          </span>
        </div>
      </div>

      {/* Top Header & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 p-2 border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-accent font-bold text-xs uppercase tracking-wider">
            <Network className="h-4 w-4" />
            <span>INTERCONNECTED CORPORATE &amp; SUPPLY CHAIN WEB</span>
          </div>

          <div className="flex items-center border border-border bg-surface-muted/40 text-3xs">
            <button
              type="button"
              onClick={() => setActiveMode("SPLC")}
              className={`px-2 py-1 font-bold uppercase transition-colors ${
                activeMode === "SPLC"
                  ? "bg-accent text-accent-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SUPPLY CHAIN WEB (SPLC)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("HOLD")}
              className={`px-2 py-1 font-bold uppercase transition-colors ${
                activeMode === "HOLD"
                  ? "bg-accent text-accent-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              HOLDINGS HIERARCHY (HOLD)
            </button>
          </div>
        </div>

        {/* Symbol Quick Pills & Input */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <div className="hidden sm:flex items-center gap-1 text-3xs text-muted-foreground">
            <span>PEERS:</span>
            {["M&M", "TATAMOTORS", "RELIANCE", "LT"].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  setSymbolInput(sym);
                  handleSearchSymbol(sym);
                }}
                className={`px-1 py-0.5 border transition-colors ${
                  sym === initialSymbol
                    ? "bg-accent/20 border-accent text-accent font-bold"
                    : "border-border/60 hover:border-foreground text-muted-foreground"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSymbol(symbolInput);
            }}
            className="flex items-center gap-1"
          >
            <div className="relative">
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="TICKER..."
                className="w-24 h-6 px-1.5 text-3xs font-mono uppercase bg-background border border-border focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-6 px-2 bg-surface-raised border border-border hover:border-accent text-3xs font-bold uppercase text-foreground transition-colors"
            >
              GO
            </button>
          </form>
        </div>
      </div>

      {/* Institutional Micro-Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-3xs">
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">Corporate Group</div>
          <div className="font-bold text-foreground text-2xs mt-0.5 truncate">
            {initialSummary.group_name}
          </div>
        </div>
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">
            {activeMode === "SPLC" ? "Tracked Tier-1 Suppliers" : "Subsidiaries & Associates"}
          </div>
          <div className="font-bold text-accent text-2xs mt-0.5">
            {activeMode === "SPLC"
              ? initialSummary.total_suppliers_tracked
              : initialSummary.total_holding_subsidiaries}
          </div>
        </div>
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">Sole-Source Bottlenecks</div>
          <div className="font-bold text-destructive text-2xs mt-0.5 flex items-center gap-1">
            <span>{initialSummary.sole_source_bottlenecks}</span>
            {initialSummary.sole_source_bottlenecks > 0 && (
              <span className="text-3xs font-normal text-destructive/80">(Vulnerability)</span>
            )}
          </div>
        </div>
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">High-Dependency Suppliers</div>
          <div className="font-bold text-amber-500 text-2xs mt-0.5">
            {initialSummary.high_dependency_suppliers} (&gt;10% rev)
          </div>
        </div>
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">Customer Channels</div>
          <div className="font-bold text-foreground text-2xs mt-0.5">
            {initialSummary.total_customer_segments} Institutional Segments
          </div>
        </div>
        <div className="p-2 border border-border bg-surface">
          <div className="text-muted-foreground">Audited Filing Provenance</div>
          <div className="font-bold text-up text-2xs mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-up shrink-0" />
            <span>{initialSummary.provenance_summary.audited_filing_nodes} Nodes Grounded</span>
          </div>
        </div>
      </div>

      {/* Cluster Filter Tabs (SPLC Mode Only) */}
      {activeMode === "SPLC" && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-3xs border-b border-border/60">
          <span className="text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
            <Filter className="h-3 w-3" />
            <span>CLUSTER:</span>
          </span>
          {["ALL", "SOLE_SOURCE", ...initialSummary.product_clusters].map((cl) => (
            <button
              key={cl}
              type="button"
              onClick={() => setActiveCluster(cl)}
              className={`px-1.5 py-0.5 border whitespace-nowrap transition-colors ${
                activeCluster === cl
                  ? "bg-accent text-accent-foreground border-accent font-bold"
                  : "bg-surface text-muted-foreground border-border/80 hover:text-foreground hover:border-foreground"
              }`}
            >
              {cl === "ALL" ? "ALL CLUSTERS" : cl === "SOLE_SOURCE" ? "⚠️ SOLE-SOURCE RISKS" : cl}
            </button>
          ))}
        </div>
      )}

      {/* Network Graph Interactive Canvas */}
      <div className="relative border border-border bg-surface-muted/20 overflow-hidden shadow-inner h-[620px]">
        {/* Graph Canvas Controls */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-surface/90 border border-border p-1 backdrop-blur-sm text-3xs">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 2.0))}
            className="p-1 hover:bg-surface-raised text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.6))}
            className="p-1 hover:bg-surface-raised text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="p-1 hover:bg-surface-raised text-muted-foreground hover:text-foreground"
            title="Reset View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <span className="text-3xs text-muted-foreground ml-1 font-mono">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-2.5 bg-surface/95 border border-border px-2 py-1 text-3xs text-muted-foreground backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 bg-accent/20 border border-accent"></span>
            <span>Focus Target</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 bg-blue-500/20 border border-blue-500"></span>
            <span>Tier-1 Supplier</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500/20 border border-emerald-500"></span>
            <span>Customer Channel</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 bg-purple-500/20 border border-purple-500"></span>
            <span>Subsidiary / JV</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
            <span className="text-destructive font-bold">Sole-Source Risk</span>
          </div>
        </div>

        {/* SVG Render Surface */}
        <svg
          viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
          className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: "transform 0.15s ease-out",
          }}
        >
          <defs>
            {/* Arrow markers for edges */}
            <marker
              id="arrow-supplier"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
            <marker
              id="arrow-customer"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
            <marker
              id="arrow-subsidiary"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
            </marker>
          </defs>

          {/* SPLC Mode: Connector Edges */}
          {activeMode === "SPLC" && (
            <g className="edges opacity-75">
              {/* Supplier to Target Edges */}
              {graphLayout.suppliers.map((s) => {
                const isSole = s.data.is_sole_source;
                const strokeWidth = Math.max(1.2, Math.min(s.data.cogs_share_pct / 1.5, 4));
                return (
                  <path
                    key={`edge-${s.id}`}
                    d={`M ${s.x} ${s.y} C ${s.x + 120} ${s.y}, ${graphLayout.targetNode.x - 120} ${
                      graphLayout.targetNode.y
                    }, ${graphLayout.targetNode.x} ${graphLayout.targetNode.y}`}
                    fill="none"
                    stroke={isSole ? "#ef4444" : "#3b82f6"}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSole ? "4,3" : "none"}
                    markerEnd="url(#arrow-supplier)"
                  />
                );
              })}

              {/* Target to Customer Edges */}
              {graphLayout.customers.map((c) => {
                const strokeWidth = Math.max(1.2, Math.min(c.data.volume_share_pct / 10, 3.5));
                return (
                  <path
                    key={`edge-${c.id}`}
                    d={`M ${graphLayout.targetNode.x} ${graphLayout.targetNode.y} C ${
                      graphLayout.targetNode.x + 120
                    } ${graphLayout.targetNode.y}, ${c.x - 120} ${c.y}, ${c.x} ${c.y}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={strokeWidth}
                    markerEnd="url(#arrow-customer)"
                  />
                );
              })}

              {/* Target to Contractor Edges */}
              {graphLayout.contractors.map((ct) => (
                <path
                  key={`edge-${ct.id}`}
                  d={`M ${graphLayout.targetNode.x} ${graphLayout.targetNode.y} L ${ct.x} ${ct.y}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
              ))}
            </g>
          )}

          {/* HOLD Mode: Connector Edges */}
          {activeMode === "HOLD" && (
            <g className="edges opacity-75">
              {graphLayout.subsidiaries.map((sub) => (
                <path
                  key={`edge-${sub.id}`}
                  d={`M ${graphLayout.targetNode.x} ${graphLayout.targetNode.y} C ${
                    graphLayout.targetNode.x
                  } ${graphLayout.targetNode.y + 70}, ${sub.x} ${sub.y - 70}, ${sub.x} ${sub.y}`}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.8"
                  markerEnd="url(#arrow-subsidiary)"
                />
              ))}
            </g>
          )}

          {/* Central Target Node */}
          <g
            className="target-node cursor-pointer group"
            onClick={() => handleSearchSymbol(graphLayout.targetNode.symbol)}
          >
            {/* Pulsing Accent Glow */}
            <circle
              cx={graphLayout.targetNode.x}
              cy={graphLayout.targetNode.y}
              r="46"
              fill="currentColor"
              className="text-accent/10 animate-pulse"
            />
            <circle
              cx={graphLayout.targetNode.x}
              cy={graphLayout.targetNode.y}
              r="38"
              fill="hsl(var(--surface))"
              stroke="hsl(var(--accent))"
              strokeWidth="2.5"
            />
            <text
              x={graphLayout.targetNode.x}
              y={graphLayout.targetNode.y - 6}
              textAnchor="middle"
              className="fill-foreground font-bold text-[12px] uppercase"
            >
              {graphLayout.targetNode.symbol}
            </text>
            <text
              x={graphLayout.targetNode.x}
              y={graphLayout.targetNode.y + 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px] uppercase tracking-wider"
            >
              {activeMode === "SPLC" ? "OEM HUB" : "PARENT"}
            </text>
          </g>

          {/* SPLC Mode Nodes */}
          {activeMode === "SPLC" && (
            <>
              {/* Suppliers */}
              {graphLayout.suppliers.map((s) => {
                const isSelected = selectedNode?.name === s.data.name;
                const isSole = s.data.is_sole_source;
                return (
                  <g
                    key={s.id}
                    className="supplier-node cursor-pointer group transition-transform hover:scale-105"
                    onClick={() => handleNodeClick(s)}
                  >
                    <rect
                      x={s.x - 70}
                      y={s.y - 20}
                      width="140"
                      height="40"
                      rx="0"
                      ry="0"
                      fill="hsl(var(--surface))"
                      stroke={isSelected ? "hsl(var(--accent))" : isSole ? "#ef4444" : "#3b82f6"}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      className="shadow-sm hover:fill-surface-raised"
                    />
                    {isSole && (
                      <circle cx={s.x + 62} cy={s.y - 14} r="4" fill="#ef4444" className="animate-pulse" />
                    )}
                    <text
                      x={s.x - 62}
                      y={s.y - 4}
                      className="fill-foreground font-bold text-[10px] truncate"
                    >
                      {s.data.symbol || s.data.name.slice(0, 16)}
                    </text>
                    <text
                      x={s.x - 62}
                      y={s.y + 11}
                      className="fill-muted-foreground text-[7.5px] uppercase truncate"
                    >
                      {s.data.cluster.slice(0, 20)}
                    </text>
                  </g>
                );
              })}

              {/* Customers */}
              {graphLayout.customers.map((c) => {
                const isSelected = selectedNode?.name === c.data.name;
                return (
                  <g
                    key={c.id}
                    className="customer-node cursor-pointer group transition-transform hover:scale-105"
                    onClick={() => handleNodeClick(c)}
                  >
                    <rect
                      x={c.x - 75}
                      y={c.y - 20}
                      width="150"
                      height="40"
                      rx="0"
                      ry="0"
                      fill="hsl(var(--surface))"
                      stroke={isSelected ? "hsl(var(--accent))" : "#10b981"}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      className="shadow-sm hover:fill-surface-raised"
                    />
                    <text
                      x={c.x - 68}
                      y={c.y - 4}
                      className="fill-foreground font-bold text-[9.5px] truncate"
                    >
                      {c.data.name.slice(0, 20)}
                    </text>
                    <text
                      x={c.x - 68}
                      y={c.y + 11}
                      className="fill-emerald-500 text-[7.5px] uppercase font-bold"
                    >
                      {c.data.volume_share_pct}% OFFTAKE
                    </text>
                  </g>
                );
              })}

              {/* Contractors */}
              {graphLayout.contractors.map((ct) => (
                <g
                  key={ct.id}
                  className="contractor-node cursor-pointer group"
                  onClick={() => handleNodeClick(ct)}
                >
                  <rect
                    x={ct.x - 60}
                    y={ct.y - 14}
                    width="120"
                    height="28"
                    rx="0"
                    ry="0"
                    fill="hsl(var(--surface))"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={ct.x}
                    y={ct.y + 3}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px] uppercase truncate"
                  >
                    {ct.data.name.slice(0, 18)}
                  </text>
                </g>
              ))}
            </>
          )}

          {/* HOLD Mode Nodes */}
          {activeMode === "HOLD" && (
            <>
              {graphLayout.subsidiaries.map((sub) => {
                const isSelected = selectedNode?.name === sub.data.name;
                const isListed = sub.data.listing_status === "LISTED";
                return (
                  <g
                    key={sub.id}
                    className="subsidiary-node cursor-pointer group transition-transform hover:scale-105"
                    onClick={() => handleNodeClick(sub)}
                  >
                    <rect
                      x={sub.x - 80}
                      y={sub.y - 32}
                      width="160"
                      height="64"
                      rx="0"
                      ry="0"
                      fill="hsl(var(--surface))"
                      stroke={isSelected ? "hsl(var(--accent))" : "#a855f7"}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      className="shadow-sm hover:fill-surface-raised"
                    />
                    <text
                      x={sub.x - 72}
                      y={sub.y - 14}
                      className="fill-foreground font-bold text-[10px] truncate"
                    >
                      {sub.data.symbol ? `NSE: ${sub.data.symbol}` : sub.data.name.slice(0, 20)}
                    </text>
                    <text
                      x={sub.x - 72}
                      y={sub.y + 2}
                      className="fill-muted-foreground text-[8px] truncate"
                    >
                      {sub.data.name.slice(0, 24)}
                    </text>
                    <text
                      x={sub.x - 72}
                      y={sub.y + 18}
                      className="fill-purple-400 text-[8px] font-bold uppercase tracking-wider"
                    >
                      {sub.data.ownership_pct}% STAKE • {isListed ? "LISTED" : "UNLISTED"}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Floating Node Dossier Drawer */}
      <NodeDossierDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onSelectNode={(sym) => {
          setSelectedNode(null);
          setSymbolInput(sym);
          handleSearchSymbol(sym);
        }}
      />
    </div>
  );
}
