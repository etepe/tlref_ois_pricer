/**
 * Root app shell: owns market-data state, runs the bootstrap + bond
 * pricer + implied-PPK extraction in one memoized chain, and dispatches
 * the active tab's subview.
 *
 * All pricing flows through this single pipeline so every tab stays
 * consistent with the current side (bid/mid/ask) and the latest user
 * edits in the Market Data tab.
 */

import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { bootstrapIso } from "../core/bootstrap";
import { parseIso } from "../core/calendar";
import { extractImpliedPPK } from "../core/implied-ppk";
import { buildOffshoreNodes, offshoreDFFromRate } from "../core/offshore";
import { priceBonds } from "../core/zspread";
import type { OISQuote, OffshoreQuote, QuoteSide } from "../core/types";
import { DEFAULT_BONDS } from "../data/bonds";
import { DEFAULT_OIS_QUOTES } from "../data/ois-quotes";
import { DEFAULT_OFFSHORE_QUOTES } from "../data/offshore-quotes";
import { CBRT_MEETING_DATES, DEFAULT_TRADE_DATE } from "../data/ppk-dates";
import { BondsTab } from "./BondsTab";
import { Header } from "./Header";
import { MarketTab } from "./MarketTab";
import { C } from "./theme";
import { Tabs, type TabId } from "./Tabs";

/**
 * Seed spot TLREF level used by the Scenario sub-tab. Matches the O/N
 * BISTTREF level at the 2026-04-13 snapshot embedded in the default
 * OIS quotes — good anchor for "what PPK path does the market imply?".
 */
const SPOT_TLREF_DEFAULT = 39.99;

export default function App(): JSX.Element {
  const [side, setSide] = useState<QuoteSide>("mid");
  const [activeTab, setActiveTab] = useState<TabId>("bonds");

  const [oisQuotes, setOisQuotes] = useState<OISQuote[]>(
    () => DEFAULT_OIS_QUOTES.map((q) => ({ ...q })),
  );
  const [offQuotes, setOffQuotes] = useState<OffshoreQuote[]>(
    () => DEFAULT_OFFSHORE_QUOTES.map((q) => ({ ...q })),
  );

  // --- Edits -----------------------------------------------------------------

  const handleOisChange = useCallback(
    (index: number, field: "bid" | "ask", value: number) => {
      setOisQuotes((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleOffChange = useCallback((index: number, rate: number) => {
    setOffQuotes((prev) => {
      const next = [...prev];
      const q = next[index];
      next[index] = {
        ...q,
        rate,
        df: offshoreDFFromRate(rate, q.days),
      };
      return next;
    });
  }, []);

  // --- Pricing pipeline ------------------------------------------------------

  const bootstrapResult = useMemo(
    () => bootstrapIso(oisQuotes, DEFAULT_TRADE_DATE, side),
    [oisQuotes, side],
  );
  const oisNodes = bootstrapResult.nodes;
  const valueDate = bootstrapResult.valueDate;

  const offNodes = useMemo(() => buildOffshoreNodes(offQuotes), [offQuotes]);

  const bondAnalytics = useMemo(
    () => priceBonds(DEFAULT_BONDS, oisNodes, offNodes, parseIso(valueDate)),
    [oisNodes, offNodes, valueDate],
  );

  const implied = useMemo(
    () => extractImpliedPPK(bootstrapResult, CBRT_MEETING_DATES),
    [bootstrapResult],
  );

  // --- Render ----------------------------------------------------------------

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.tx,
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <Header
        tradeDate={DEFAULT_TRADE_DATE}
        valueDate={valueDate}
        side={side}
        onSideChange={setSide}
      />
      <Tabs active={activeTab} onChange={setActiveTab} />

      <div style={{ padding: "14px 16px" }}>
        {activeTab === "bonds" && (
          <BondsTab
            analytics={bondAnalytics}
            oisNodes={oisNodes}
            offNodes={offNodes}
          />
        )}
        {activeTab === "market" && (
          <MarketTab
            oisQuotes={oisQuotes}
            offQuotes={offQuotes}
            oisNodes={oisNodes}
            offNodes={offNodes}
            implied={implied}
            side={side}
            spotTlref={SPOT_TLREF_DEFAULT}
            onOisChange={handleOisChange}
            onOffChange={handleOffChange}
          />
        )}
      </div>

      <div
        style={{
          padding: "6px 16px",
          borderTop: `1px solid ${C.bd}`,
          fontSize: "9px",
          color: C.tm,
          fontFamily: "monospace",
          textAlign: "right",
          letterSpacing: "1px",
        }}
      >
        FETM RESEARCH — TLREF OIS PRICER
      </div>
    </div>
  );
}
