# TLREF OIS Pricer

Client-side React + TypeScript pricer for Turkish OIS curves. Bootstraps
the onshore TLREF OIS curve from market quotes, computes the implied
policy-rate path between PPK meetings, prices TLREF-linked / fixed /
zero-coupon bonds on both OIS and offshore (TRYI) curves, and shows the
offshore-onshore basis.

The numerical core is a direct TypeScript port of
[`etepe/Ois_pricer`](https://github.com/etepe/Ois_pricer)'s Python
engine (`engine_v2/bootstrap.py`, `engine.py`), validated against the
Python reference to 1e-10 on every DF node.

## Architecture

```
src/
├── core/                 Pure numerics, no React dependency
│   ├── calendar.ts       Istanbul BD calendar, modified following
│   ├── interpolation.ts  Log-linear DF interpolation, zero-rate helper
│   ├── bootstrap.ts      OIS curve bootstrap (short end + quarterly)
│   ├── implied-ppk.ts    Forward rates between PPK meetings
│   ├── offshore.ts       Direct TRYI DF nodes (Act/360)
│   ├── zspread.ts        Bond CFs + bisection Z-spread solver
│   └── types.ts
├── data/                 Shipping defaults (2026-04-13 snapshot)
│   ├── holidays.ts       Dumped from Python `holidays` package (2020-2035)
│   ├── ois-quotes.ts     13 TYSO tenors with bid/ask
│   ├── offshore-quotes.ts TRYI ON/TN/1W…3Y
│   ├── bonds.ts          22 TRT/TRB universe bonds
│   └── ppk-dates.ts      CBRT meeting calendar
├── components/           Inline-styled UI (no Tailwind)
│   ├── App.tsx           Owns state; dispatches tabs
│   ├── Header.tsx        Trade/VD readout + bid/mid/ask toggle
│   ├── Tabs.tsx
│   ├── BondsTab.tsx
│   ├── RatesTab.tsx      Market Data + Curves & Basis + Implied PPK
│   ├── Chart.tsx         Minimal SVG chart primitive
│   └── theme.ts          Color palette
└── main.tsx

tests/
├── smoke/                Hardcoded sanity tests
├── validate/             Diff against Python-generated JSON fixtures
└── fixtures/             Produced by scripts/generate_fixtures.py

scripts/
├── generate_fixtures.py  Run ois_pricer engine → JSON test fixtures
└── build_bbg_template.py Generate bloomberg/tlref_ois_template.xlsx

bloomberg/
└── tlref_ois_template.xlsx  Blank Bloomberg-connected workbook
```

## Conventions

* **Day count:** Act/365 for onshore OIS, Act/360 for offshore TRYI.
* **Settlement:** T+1 (value date = trade date + 1 business day).
* **Payment frequency:** quarterly (3M) for OIS tenors > 3M.
* **Interpolation:** log-linear on discount factors.
* **Holiday calendar:** Turkish public holidays from the Python
  `holidays` package, dumped to `src/data/holidays.ts` (2020-2035).

## Usage

Easiest: double-click **`run.bat`** (Windows) or run **`./run.sh`**
(macOS/Linux). The script installs dependencies on first run, starts
the Vite dev server, and opens the app in Chrome.

Manual:

```bash
npm install
npm run dev       # local dev server
npm run build     # production bundle → dist/
npm run start     # serve dist/ on $PORT (default 4173)
npm run test      # vitest
npm run typecheck # tsc -b
```

## Bloomberg data refresh

`bloomberg/tlref_ois_template.xlsx` is a blank workbook pre-populated
with the tickers the pricer needs (13 OIS, 13 TRYI, 22 bond ISINs,
BISTTREF). Open it on a Bloomberg-connected machine, uncomment the BDP
formula hints in each sheet, let Excel refresh, save, and commit the
filled workbook back.

A companion import script is sketched on the workbook's **Export** sheet —
copy it into `scripts/import_bbg_template.py` and it will regenerate
`src/data/ois-quotes.ts`, `offshore-quotes.ts`, and `bonds.ts` from the
filled workbook.

## Validating against the Python reference

```bash
# One-time: clone the Python engine next to this repo.
cd ..
git clone https://github.com/etepe/Ois_pricer.git
cd tlref_ois_pricer

# Regenerate fixtures and run the deep-diff suite.
python3 scripts/generate_fixtures.py
npm run test
```

Both the smoke tests and the `vs Python` suite must pass to publish a
release; the latter asserts DF agreement to 1e-10 on every node.
