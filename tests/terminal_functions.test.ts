import { describe, it, expect } from "vitest";
import { parseTerminalCommand, TERMINAL_FUNCTIONS } from "../lib/terminal/functions";

describe("Terminal Command Parsing & Routing", () => {
  it("binds SPLC and NETWORK to corporate network routes", () => {
    const splc = parseTerminalCommand("SPLC");
    expect(splc.isValid).toBe(true);
    expect(splc.targetUrl).toBe("/network?mode=splc");

    const network = parseTerminalCommand("NETWORK");
    expect(network.isValid).toBe(true);
    expect(network.targetUrl).toBe("/network?mode=splc");

    const withTicker = parseTerminalCommand("RELIANCE SPLC");
    expect(withTicker.isValid).toBe(true);
    expect(withTicker.targetUrl).toBe("/company/RELIANCE/network?mode=splc");
  });

  it("binds STRS to Quant Risk Lab", () => {
    const cmd = parseTerminalCommand("STRS");
    expect(cmd.isValid).toBe(true);
    expect(cmd.targetUrl).toBe("/risk-lab");

    const alias = parseTerminalCommand("RISK");
    expect(alias.isValid).toBe(true);
    expect(alias.targetUrl).toBe("/risk-lab");
  });

  it("binds SKPI to Sector Operating KPIs", () => {
    const cmd = parseTerminalCommand("SKPI");
    expect(cmd.isValid).toBe(true);
    expect(cmd.targetUrl).toBe("/sectors");

    const alias = parseTerminalCommand("SECTORS");
    expect(alias.isValid).toBe(true);
    expect(alias.targetUrl).toBe("/sectors");
  });

  it("binds VAL and DCF to Valuation Lab", () => {
    const val = parseTerminalCommand("VAL");
    expect(val.isValid).toBe(true);
    expect(val.targetUrl).toBe("/company/RELIANCE/valuation");

    const dcf = parseTerminalCommand("DCF");
    expect(dcf.isValid).toBe(true);
    expect(dcf.targetUrl).toBe("/company/RELIANCE/valuation");

    const tcsVal = parseTerminalCommand("TCS VAL");
    expect(tcsVal.isValid).toBe(true);
    expect(tcsVal.targetUrl).toBe("/company/TCS/valuation");

    const infyDcf = parseTerminalCommand("INFY DCF");
    expect(infyDcf.isValid).toBe(true);
    expect(infyDcf.targetUrl).toBe("/company/INFY/valuation");
  });

  it("binds SME to Dedicated SME Board", () => {
    const cmd = parseTerminalCommand("SME");
    expect(cmd.isValid).toBe(true);
    expect(cmd.targetUrl).toBe("/sme");

    const emerge = parseTerminalCommand("EMERGE");
    expect(emerge.isValid).toBe(true);
    expect(emerge.targetUrl).toBe("/sme");
  });

  it("binds TEAR to Institutional Tear Sheet", () => {
    const cmd = parseTerminalCommand("TEAR");
    expect(cmd.isValid).toBe(true);
    expect(cmd.targetUrl).toBe("/company/RELIANCE/tear");

    const tcsTear = parseTerminalCommand("TCS TEAR");
    expect(tcsTear.isValid).toBe(true);
    expect(tcsTear.targetUrl).toBe("/company/TCS/tear");
  });

  it("binds W and WORKSPACE to Terminal Launchpad Shell", () => {
    const w = parseTerminalCommand("W");
    expect(w.isValid).toBe(true);
    expect(w.targetUrl).toBe("/workspace");

    const workspace = parseTerminalCommand("WORKSPACE");
    expect(workspace.isValid).toBe(true);
    expect(workspace.targetUrl).toBe("/workspace");
  });

  it("binds EMSX to Live Broker Execution Gateway", () => {
    const cmd = parseTerminalCommand("EMSX");
    expect(cmd.isValid).toBe(true);
    expect(cmd.targetUrl).toBe("/paper-trading?tab=emsx");
  });
});
