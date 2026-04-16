/**
 * Shared core types for the TLREF OIS pricer.
 *
 * The pricing flow is: market quotes → bootstrap → DF curve → derived
 * analytics (implied PPK, bond Z-spread, offshore basis). Types in this
 * module describe the shapes that cross module boundaries.
 */

// --- OIS market quotes ------------------------------------------------------

/**
 * An OIS swap quote. Exactly one of `months` or `days` is non-zero:
 * day/week tenors (1W, 2W) use `days`; month/year tenors use `months`.
 * Rates are in percent (e.g. 40.25 not 0.4025).
 */
export interface OISQuote {
  tenor: string;
  months: number;
  days: number;
  bid: number;
  ask: number;
}

export type QuoteSide = "bid" | "mid" | "ask";

// --- Discount factor curve --------------------------------------------------

/**
 * A single bootstrapped discount factor node on the curve.
 */
export interface DFNode {
  /** Calendar days from value date (T+1). */
  days: number;
  /** Discount factor at `days`. */
  df: number;
  /** ISO maturity date. */
  matDate: string;
  /** Tenor label (market label for exact matches, "6M"/"9M"... otherwise). */
  tenor: string;
  /** Par swap rate used for this node, in decimal (0.4025 = 40.25%). */
  parRate: number;
}

/**
 * Full bootstrap result returned to the UI and downstream consumers.
 */
export interface BootstrapResult {
  /** ISO value date (trade_date + 1 BD). */
  valueDate: string;
  /** ISO trade date (T). */
  tradeDate: string;
  /** DF nodes sorted ascending by `days`, always includes the t=0 anchor. */
  nodes: DFNode[];
}

// --- Implied PPK ------------------------------------------------------------

/**
 * Market-implied policy rate between two consecutive PPK meetings
 * (or between value date and the first future meeting).
 */
export interface ImpliedPPK {
  /** ISO meeting date. */
  date: string;
  /** Days from value date to this meeting. */
  daysFromVd: number;
  /** Days from previous anchor (previous meeting or value date). */
  periodDays: number;
  /** DF at this meeting. */
  df: number;
  /** Forward rate from previous anchor to this meeting, decimal Act/365. */
  forwardRate: number;
  /** Same forward rate expressed in percent. */
  impliedRatePct: number;
}

// --- Bond Z-spread ----------------------------------------------------------

/** Bond payoff type for Z-spread pricing. */
export type BondType = "flt" | "fix" | "zcb";

/**
 * A Turkish government bond for Z-spread analytics.
 * - `flt`: TLREF-linked floating (quarterly, forward-rate coupons)
 * - `fix`: fixed-coupon (2x/year typically)
 * - `zcb`: zero-coupon (single principal cash flow)
 */
export interface Bond {
  isin: string;
  /** ISO maturity date. */
  maturity: string;
  /** Annual coupon in percent; ignored for zcb. */
  coupon: number;
  /** Coupons per year: 4 for floating, 2 for semi-annual fixed, 0 for zcb. */
  freq: number;
  /** Last traded price (dirty for TLREF floaters, clean for fixed). */
  lastPrice: number;
  type: BondType;
}

/** Cash flow point for bond PV calculation. */
export interface BondCashFlow {
  /** Days from value date. */
  days: number;
  /** Cash flow amount (as a percent of face). */
  cf: number;
}

/** Result row for bond Z-spread analytics. */
export interface BondAnalytics {
  bond: Bond;
  /** Days to maturity from value date. */
  dtm: number;
  /** Z-spread vs OIS curve, in percent. */
  zSpreadOIS: number;
  /** Z-spread vs offshore TRYI curve, in percent. */
  zSpreadOff: number;
  /** PV on pure OIS curve (no spread), in percent of face. */
  pvOIS: number;
  /** Bond yield = OIS zero rate at DTM + Z-spread. */
  yieldOIS: number;
}

// --- Offshore TRYI ----------------------------------------------------------

/**
 * Offshore TRY (TRYI) quote. Rates on Act/360; DF is the Bloomberg-provided
 * discount factor (can be recomputed from rate/days if edited).
 */
export interface OffshoreQuote {
  tenor: string;
  days: number;
  rate: number;
  df: number;
  ticker: string;
}
