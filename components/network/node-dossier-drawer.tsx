"use client";

import Link from "next/link";
import { X, ExternalLink, ShieldAlert, CheckCircle2, Building2, Truck, Layers, Globe, ArrowRight } from "lucide-react";
import { formatCrore, formatPct } from "@/lib/utils";

export interface SelectedNodeData {
  id: string;
  name: string;
  symbol: string | null;
  role: "TARGET" | "SUPPLIER" | "CUSTOMER" | "SUBSIDIARY" | "CONTRACTOR";
  listing_status?: string;
  tier?: string;
  cluster?: string;
  component?: string;
  dependency_pct?: number;
  cogs_share_pct?: number;
  is_sole_source?: boolean;
  contract_type?: string;
  origin?: string;
  location?: string;
  ownership_pct?: number;
  revenue_contrib_cr?: number;
  ebitda_contrib_pct?: number;
  business_segment?: string;
  channel_type?: string;
  volume_share_pct?: number;
  regions?: string;
  key_products?: string;
  service_category?: string;
  scope?: string;
  spend_cr?: number;
  provenance: string;
}

interface NodeDossierDrawerProps {
  node: SelectedNodeData | null;
  onClose: () => void;
  onSelectNode: (symbol: string) => void;
}

export function NodeDossierDrawer({ node, onClose, onSelectNode }: NodeDossierDrawerProps) {
  if (!node) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-surface border-l border-border shadow-2xl flex flex-col font-mono text-2xs overflow-hidden transition-transform animate-in slide-in-from-right duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-muted/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="font-bold uppercase tracking-wider text-3xs text-accent">
            ENTITY INTELLIGENCE DOSSIER
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          title="Close Drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Entity Title & Status */}
      <div className="p-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-foreground truncate">{node.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-3xs text-muted-foreground">
              {node.symbol ? (
                <span className="font-bold text-accent bg-accent/10 px-1 py-0.2 border border-accent/20">
                  NSE: {node.symbol}
                </span>
              ) : (
                <span className="text-muted-foreground bg-surface-muted px-1 py-0.2 border border-border">
                  UNLISTED / DIVISION
                </span>
              )}
              <span>•</span>
              <span className="font-bold text-foreground uppercase">{node.role}</span>
            </div>
          </div>
          <span
            className={`text-3xs px-1.5 py-0.5 font-bold uppercase tracking-wider shrink-0 border ${
              node.provenance === "ACTUAL FILING"
                ? "bg-up/10 text-up border-up/30"
                : "bg-surface-muted text-muted-foreground border-border"
            }`}
          >
            {node.provenance}
          </span>
        </div>

        {/* Sole Source Alert Banner */}
        {node.is_sole_source && (
          <div className="mt-2.5 p-2 bg-destructive/10 border border-destructive/40 text-destructive text-3xs flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="font-bold">
              CRITICAL VULNERABILITY: Single / Sole-Source Component Supplier
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Entity Details */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 divide-y divide-border/60">
        {/* Role-Specific Metrics */}
        {node.role === "SUPPLIER" && (
          <div className="space-y-2 pt-1">
            <div className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground">
              SUPPLY &amp; PROCUREMENT METRICS
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Component Cluster</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">{node.cluster || "—"}</div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Supplier Tier</div>
                <div className="font-bold text-accent text-3xs mt-0.5">{node.tier || "TIER 1"}</div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Buyer COGS Share</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">
                  {node.cogs_share_pct ? `${node.cogs_share_pct.toFixed(1)}% of COGS` : "—"}
                </div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Revenue Dependency</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">
                  {node.dependency_pct ? `${node.dependency_pct.toFixed(1)}% of Supplier Rev` : "—"}
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="text-3xs text-muted-foreground">Components &amp; Assemblies Supplied:</div>
              <div className="text-3xs text-foreground bg-surface-muted/40 p-1.5 border border-border/60 leading-relaxed">
                {node.component || "Standard automotive & industrial component assemblies."}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-3xs pt-1">
              <div>
                <span className="text-muted-foreground">Contract Structure: </span>
                <span className="font-bold text-foreground">{node.contract_type || "Framework"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Plant Location: </span>
                <span className="font-bold text-foreground">{node.location || "Domestic India"}</span>
              </div>
            </div>
          </div>
        )}

        {node.role === "SUBSIDIARY" && (
          <div className="space-y-2 pt-1">
            <div className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground">
              CONGLOMERATE HOLDING &amp; FINANCIAL CONTRIBUTION
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Parent Ownership Stake</div>
                <div className="font-bold text-accent text-3xs mt-0.5">
                  {node.ownership_pct ? `${node.ownership_pct.toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Listing Structure</div>
                <div className="font-bold text-foreground text-3xs mt-0.5 truncate">
                  {node.listing_status || "SUBSIDIARY"}
                </div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Revenue Contribution</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">
                  {node.revenue_contrib_cr ? `₹${node.revenue_contrib_cr.toLocaleString("en-IN")} Cr` : "—"}
                </div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Group EBITDA Share</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">
                  {node.ebitda_contrib_pct !== undefined ? `${node.ebitda_contrib_pct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="text-3xs text-muted-foreground">Business Operations &amp; Mandate:</div>
              <div className="text-3xs text-foreground bg-surface-muted/40 p-1.5 border border-border/60 leading-relaxed">
                {node.business_segment || "Operating subsidiary of the corporate group."}
              </div>
            </div>
          </div>
        )}

        {node.role === "CUSTOMER" && (
          <div className="space-y-2 pt-1">
            <div className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground">
              CUSTOMER CHANNEL &amp; OFFTAKE BREAKDOWN
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Channel Type</div>
                <div className="font-bold text-accent text-3xs mt-0.5">{node.channel_type || "Direct"}</div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Volume Offtake Share</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">
                  {node.volume_share_pct ? `${node.volume_share_pct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-3xs text-muted-foreground">Key Products Purchased:</div>
              <div className="text-3xs text-foreground bg-surface-muted/40 p-1.5 border border-border/60">
                {node.key_products || "Commercial fleet and consumer retail products."}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-3xs text-muted-foreground">Geographic Distribution:</div>
              <div className="text-3xs text-foreground bg-surface-muted/40 p-1.5 border border-border/60">
                {node.regions || "Pan-India and export corridors."}
              </div>
            </div>
          </div>
        )}

        {node.role === "CONTRACTOR" && (
          <div className="space-y-2 pt-1">
            <div className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground">
              INDEPENDENT CONTRACTOR &amp; LOGISTICS
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Service Category</div>
                <div className="font-bold text-foreground text-3xs mt-0.5">{node.service_category || "3PL Logistics"}</div>
              </div>
              <div className="p-1.5 border border-border/80 bg-surface-muted/30">
                <div className="text-3xs text-muted-foreground">Annual Spend</div>
                <div className="font-bold text-accent text-3xs mt-0.5">
                  {node.spend_cr ? `₹${node.spend_cr.toLocaleString("en-IN")} Cr` : "—"}
                </div>
              </div>
            </div>
            <div className="text-3xs text-muted-foreground pt-1">
              Scope: <span className="text-foreground">{node.scope}</span>
            </div>
          </div>
        )}

        {/* Regulatory Provenance Note */}
        <div className="pt-2 text-3xs text-muted-foreground space-y-1">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground">
            Audit Provenance &amp; Disclosures
          </div>
          <p className="leading-normal">
            Grounding derived from Audited Standalone and Consolidated Financial Statements (Related Party Disclosures under Ind AS 24 / Note 34), Ministry of Corporate Affairs (MCA) regulatory filings, and official investor presentations.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-2.5 border-t border-border bg-surface-muted/60 space-y-1.5 shrink-0">
        {node.symbol && (
          <button
            type="button"
            onClick={() => onSelectNode(node.symbol!)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-accent text-accent-foreground font-bold text-3xs uppercase tracking-wider hover:bg-accent/90 transition-colors"
          >
            <span>EXPLORE {node.symbol} SUPPLY CHAIN (SPLC)</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
        {node.symbol && (
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href={`/company/${node.symbol}`}
              className="flex items-center justify-center gap-1 py-1 px-2 border border-border bg-surface hover:bg-surface-raised font-bold text-3xs text-foreground uppercase transition-colors"
            >
              <span>PROFILE (DES)</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
            </Link>
            <Link
              href={`/company/${node.symbol}/statements`}
              className="flex items-center justify-center gap-1 py-1 px-2 border border-border bg-surface hover:bg-surface-raised font-bold text-3xs text-foreground uppercase transition-colors"
            >
              <span>FINANCIALS (FA)</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
