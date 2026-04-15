"""
Generate JSON test fixtures by running ois_pricer's Python engine on the
default market data shipped in src/data/. The fixtures are then loaded
by Vitest to confirm the TypeScript port matches the Python engine to
machine precision (1e-10 on DFs, ~1e-4 bp on par rates).

Usage (from repo root):

    python3 scripts/generate_fixtures.py

Assumes `ois_pricer` has been cloned as a sibling directory:

    parent/
      Ois_pricer/          ← Python engine (validated reference)
      tlref_ois_pricer/    ← this repo

Adjust OIS_PRICER_PATH below if that layout doesn't hold.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OIS_PRICER_PATH = REPO_ROOT.parent / "Ois_pricer"

if not OIS_PRICER_PATH.exists():
    sys.exit(f"[fixtures] Ois_pricer not found at {OIS_PRICER_PATH}")

sys.path.insert(0, str(OIS_PRICER_PATH))

from engine_v2 import (  # noqa: E402
    OISQuote,
    bootstrap,
    extract_implied_ppk,
    load_holidays,
)

OUT_DIR = REPO_ROOT / "tests" / "fixtures"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Must mirror src/data/ois-quotes.ts exactly.
QUOTES = [
    OISQuote("1W",  0, 7,  39.60, 40.60),
    OISQuote("2W",  0, 14, 39.75, 40.75),
    OISQuote("1M",  1, 0,  40.30, 40.50),
    OISQuote("2M",  2, 0,  40.69, 40.89),
    OISQuote("3M",  3, 0,  41.15, 41.35),
    OISQuote("6M",  6, 0,  39.98, 40.18),
    OISQuote("9M",  9, 0,  38.98, 39.18),
    OISQuote("1Y",  12, 0, 38.05, 38.25),
    OISQuote("18M", 18, 0, 36.75, 36.95),
    OISQuote("2Y",  24, 0, 35.68, 35.88),
    OISQuote("3Y",  36, 0, 34.08, 34.30),
    OISQuote("4Y",  48, 0, 32.84, 33.05),
    OISQuote("5Y",  60, 0, 31.79, 32.02),
]

TRADE_DATE = dt.date(2026, 4, 13)

# Mirrors src/data/ppk-dates.ts
PPK_DATES = [
    dt.date(2026, 4, 24), dt.date(2026, 6, 12), dt.date(2026, 7, 24),
    dt.date(2026, 9, 11), dt.date(2026, 10, 23), dt.date(2026, 12, 11),
    dt.date(2027, 1, 22), dt.date(2027, 3, 18), dt.date(2027, 4, 26),
    dt.date(2027, 6, 11), dt.date(2027, 7, 23), dt.date(2027, 9, 3),
    dt.date(2027, 10, 15), dt.date(2027, 11, 26), dt.date(2028, 1, 7),
    dt.date(2028, 2, 18), dt.date(2028, 3, 31), dt.date(2028, 5, 12),
    dt.date(2028, 6, 23), dt.date(2028, 8, 4), dt.date(2028, 9, 15),
    dt.date(2028, 10, 27), dt.date(2028, 12, 8), dt.date(2029, 1, 19),
    dt.date(2029, 3, 2), dt.date(2029, 4, 13),
]


def main() -> None:
    hols = load_holidays()

    for side in ("bid", "mid", "ask"):
        res = bootstrap(QUOTES, TRADE_DATE, quote_type=side, hols=hols)
        payload = {
            "tradeDate": res.trade_date.isoformat(),
            "valueDate": res.value_date.isoformat(),
            "side": side,
            "nodes": [
                {
                    "days": n.days,
                    "df": n.df,
                    "matDate": n.mat_date.isoformat(),
                    "tenor": n.tenor,
                    "parRate": n.par_rate,
                }
                for n in res.nodes
            ],
        }
        (OUT_DIR / f"bootstrap-{side}.json").write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        print(f"[fixtures] bootstrap-{side}.json  ({len(res.nodes)} nodes)")

        if side == "mid":
            implied = extract_implied_ppk(res, PPK_DATES)
            ppk_payload = {
                "tradeDate": res.trade_date.isoformat(),
                "valueDate": res.value_date.isoformat(),
                "meetings": [
                    {
                        "date": p.date.isoformat(),
                        "daysFromVd": p.days_from_vd,
                        "periodDays": p.period_days,
                        "df": p.df,
                        "forwardRate": p.forward_rate,
                        "impliedRatePct": p.implied_rate_pct,
                    }
                    for p in implied
                ],
            }
            (OUT_DIR / "implied-ppk.json").write_text(
                json.dumps(ppk_payload, indent=2) + "\n", encoding="utf-8"
            )
            print(f"[fixtures] implied-ppk.json   ({len(implied)} meetings)")


if __name__ == "__main__":
    main()
