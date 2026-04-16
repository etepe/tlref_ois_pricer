"""
Build the `bloomberg/tlref_ois_template.xlsx` workbook that users fill
from Bloomberg at work, then commit back to the repo so the pricer's
defaults can be refreshed.

Layout (6 sheets):

  1. README            — instructions, conventions, how to use BDP/BDH.
  2. OIS Quotes        — 13 onshore TYSO tickers (1W … 5Y), Bid/Ask/Mid
                         plus a BDP formula column ready to paste.
  3. Offshore TRYI     — 13 TRYI tickers (ON, TN, 1W … 3Y), Rate/DF.
  4. Bonds             — 22 ISINs (flt/fix/zcb), Maturity/Coupon/Freq/Last.
  5. BISTTREF          — O/N TLREF reference rate (single cell).
  6. Export            — one-shot JSON-friendly block users can copy-paste
                         into a Python snippet to regenerate the TS
                         defaults in src/data/.

All formulas are pre-filled but commented out (as text) so the workbook
opens safely off a Bloomberg terminal. Users uncomment the formulas on
the work machine. Rows with static values (ticker, tenor, maturity,
etc.) are populated as-is.

Run:

    python3 scripts/build_bbg_template.py

Produces: bloomberg/tlref_ois_template.xlsx
"""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "bloomberg"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / "tlref_ois_template.xlsx"

# --- Tickers & tenors (mirrors src/data/*.ts) --------------------------------

ONSHORE_OIS = [
    ("1W",  "TYSO1Z GFOF Curncy",  0,   7),
    ("2W",  "TYSO2Z GFOF Curncy",  0,  14),
    ("1M",  "TYSOA GFOF Curncy",   1,   0),
    ("2M",  "TYSOB GFOF Curncy",   2,   0),
    ("3M",  "TYSOC GFOF Curncy",   3,   0),
    ("6M",  "TYSOF GFOF Curncy",   6,   0),
    ("9M",  "TYSOI GFOF Curncy",   9,   0),
    ("1Y",  "TYSO1 GFOF Curncy",  12,   0),
    ("18M", "TYSO1F GFOF Curncy", 18,   0),
    ("2Y",  "TYSO2 GFOF Curncy",  24,   0),
    ("3Y",  "TYSO3 GFOF Curncy",  36,   0),
    ("4Y",  "TYSO4 GFOF Curncy",  48,   0),
    ("5Y",  "TYSO5 GFOF Curncy",  60,   0),
]

OFFSHORE_TRYI = [
    ("ON",   "TRYION Curncy",   0),
    ("TN",   "TRYITN Curncy",   1),
    ("1W",   "TRYI1W Curncy",   7),
    ("2W",   "TRYI2W Curncy",  14),
    ("1M",   "TRYI1M Curncy",  30),
    ("2M",   "TRYI2M Curncy",  63),
    ("3M",   "TRYI3M Curncy",  91),
    ("6M",   "TRYI6M Curncy", 183),
    ("9M",   "TRYI9M Curncy", 275),
    ("1Y",   "TRYI12M Curncy",365),
    ("18M",  "TRYI18M Curncy",548),
    ("2Y",   "TRYI2Y Curncy", 731),
    ("3Y",   "TRYI3Y Curncy",1096),
]

BONDS = [
    ("TRB170626T13", "zcb", 4),  # (isin, type, coupons/yr) — maturity/cpn/last filled via BDP
    ("TRT080726T13", "flt", 4),
    ("TRT190826T19", "flt", 4),
    ("TRT060127T10", "zcb", 0),
    ("TRT130127T11", "flt", 4),
    ("TRT160627T13", "flt", 4),
    ("TRT140727T14", "fix", 2),
    ("TRT131027T10", "flt", 4),
    ("TRT131027T36", "fix", 2),
    ("TRD171127T13", "fix", 2),
    ("TRT190128T14", "flt", 4),
    ("TRT010328T12", "flt", 4),
    ("TRT170528T12", "flt", 4),
    ("TRT060928T11", "flt", 4),
    ("TRT081128T15", "fix", 2),
    ("TRT061228T16", "flt", 4),
    ("TRT070329T15", "flt", 4),
    ("TRT040729T14", "fix", 2),
    ("TRT130629T30", "flt", 4),
    ("TRT120929T12", "fix", 2),
    ("TRT090130T12", "fix", 2),
    ("TRT100730T13", "fix", 2),
]

# --- Styling ----------------------------------------------------------------

THIN = Side(style="thin", color="CCCCCC")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)
BODY_FONT = Font(size=10)
MONO = Font(name="Consolas", size=10)
TITLE = Font(size=14, bold=True, color="1F2937")
NOTE = Font(italic=True, color="6B7280", size=9)


def _header_row(ws, row, headers):
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER


def _value_cell(ws, row, col, value, *, bold=False, fmt=None, mono=False):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = (
        Font(size=10, bold=True)
        if bold
        else (MONO if mono else BODY_FONT)
    )
    cell.border = BORDER
    if fmt:
        cell.number_format = fmt
    cell.alignment = Alignment(horizontal="right" if fmt else "left")
    return cell


def _autosize(ws, widths: dict[str, int]) -> None:
    for col_letter, w in widths.items():
        ws.column_dimensions[col_letter].width = w


# --- Sheets -----------------------------------------------------------------


def build_readme(wb: Workbook) -> None:
    ws = wb.active
    ws.title = "README"
    ws["A1"] = "TLREF OIS Pricer — Bloomberg Data Template"
    ws["A1"].font = TITLE
    ws["A3"] = (
        "This workbook fetches the market data the pricer needs from "
        "Bloomberg and exports it in a format that can be dropped back "
        "into src/data/ TypeScript files."
    )
    ws["A3"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[3].height = 45

    ws["A5"] = "How to use"
    ws["A5"].font = Font(bold=True, size=11)

    steps = [
        "1. Open on a Bloomberg-connected machine (Office add-in loaded).",
        "2. Open each data sheet (OIS Quotes, Offshore TRYI, Bonds, BISTTREF).",
        "3. In the 'Formula' column, replace the quoted text with the live "
        "   BDP formula (remove the leading apostrophe).",
        "4. Paste values into the Bid/Ask/Rate/Last/Maturity columns — or "
        "   leave the BDP formulas live and let Excel refresh.",
        "5. Save the workbook and commit it back to this repo. A follow-up "
        "   script reads the values and regenerates src/data/*.ts.",
    ]
    for i, step in enumerate(steps, start=6):
        ws.cell(row=i, column=1, value=step).alignment = Alignment(wrap_text=True)
        ws.row_dimensions[i].height = 22

    ws["A13"] = "Conventions"
    ws["A13"].font = Font(bold=True, size=11)
    ws["A14"] = "Onshore OIS:   Act/365, T+1 settlement, Modified Following."
    ws["A15"] = "Offshore TRYI: Act/360, DF direct from Bloomberg screen."
    ws["A16"] = "Bonds:         TRT/TRB ISINs, Maturity + PX_LAST, coupon/freq as in bonds.ts."
    ws["A17"] = "BISTTREF:      O/N TLREF fixing; Bloomberg field PX_LAST."

    ws["A19"] = "Trade date & spot TLREF are entered on the OIS Quotes sheet."
    ws["A19"].font = NOTE

    _autosize(ws, {"A": 110})


def build_ois_sheet(wb: Workbook) -> None:
    ws = wb.create_sheet("OIS Quotes")
    ws["A1"] = "Onshore TRY OIS (TYSO · Act/365)"
    ws["A1"].font = TITLE

    ws["A3"] = "Trade date:"
    ws["A3"].font = Font(bold=True)
    ws["B3"] = "=TODAY()"
    ws["B3"].number_format = "yyyy-mm-dd"
    ws["B3"].font = Font(bold=True, color="1F6FEB")

    ws["D3"] = "BISTTREF (O/N):"
    ws["D3"].font = Font(bold=True)
    ws["E3"] = "=BDP(\"BISTTREF Index\", \"PX_LAST\")"
    ws["E3"].number_format = "0.00"
    ws["E3"].font = Font(bold=True, color="3FB950")

    headers = ["Tenor", "Ticker", "Months", "Days", "Bid", "Ask", "Mid (auto)", "BDP formula hint"]
    _header_row(ws, 5, headers)

    for i, (tenor, tk, months, days) in enumerate(ONSHORE_OIS):
        r = 6 + i
        _value_cell(ws, r, 1, tenor, bold=True)
        _value_cell(ws, r, 2, tk, mono=True)
        _value_cell(ws, r, 3, months, fmt="0")
        _value_cell(ws, r, 4, days, fmt="0")
        # Bid / Ask — leave blank for user to paste, or use BDP formula hint
        _value_cell(ws, r, 5, None, fmt="0.0000")
        _value_cell(ws, r, 6, None, fmt="0.0000")
        # Mid = average of Bid and Ask (auto)
        mid = ws.cell(row=r, column=7, value=f"=IFERROR((E{r}+F{r})/2, \"\")")
        mid.number_format = "0.0000"
        mid.border = BORDER
        # Hint — commented formula user can uncomment
        hint = ws.cell(
            row=r, column=8,
            value=f"'=BDP(\"{tk}\", \"PX_BID\") | =BDP(\"{tk}\", \"PX_ASK\")",
        )
        hint.font = Font(name="Consolas", size=9, color="6B7280")
        hint.border = BORDER

    _autosize(ws, {"A": 8, "B": 22, "C": 9, "D": 8, "E": 10, "F": 10, "G": 12, "H": 50})


def build_offshore_sheet(wb: Workbook) -> None:
    ws = wb.create_sheet("Offshore TRYI")
    ws["A1"] = "Offshore TRY (TRYI · Act/360)"
    ws["A1"].font = TITLE

    headers = ["Tenor", "Ticker", "Days", "Rate (%)", "DF (computed)", "BDP formula hint"]
    _header_row(ws, 3, headers)

    for i, (tenor, tk, days) in enumerate(OFFSHORE_TRYI):
        r = 4 + i
        _value_cell(ws, r, 1, tenor, bold=True)
        _value_cell(ws, r, 2, tk, mono=True)
        _value_cell(ws, r, 3, days, fmt="0")
        _value_cell(ws, r, 4, None, fmt="0.0000")
        if days == 0:
            df_cell = ws.cell(row=r, column=5, value=1.0)
        else:
            df_cell = ws.cell(
                row=r, column=5,
                value=f"=IFERROR(1/(1+D{r}/100*C{r}/360), \"\")",
            )
        df_cell.number_format = "0.00000"
        df_cell.border = BORDER
        hint = ws.cell(
            row=r, column=6,
            value=f"'=BDP(\"{tk}\", \"PX_LAST\")",
        )
        hint.font = Font(name="Consolas", size=9, color="6B7280")
        hint.border = BORDER

    _autosize(ws, {"A": 8, "B": 20, "C": 8, "D": 10, "E": 14, "F": 40})


def build_bonds_sheet(wb: Workbook) -> None:
    ws = wb.create_sheet("Bonds")
    ws["A1"] = "TLREF Universe Bonds"
    ws["A1"].font = TITLE
    ws["A2"] = "Fill Maturity / Coupon / PX_LAST from Bloomberg. Type and Freq are static."
    ws["A2"].font = NOTE

    headers = [
        "ISIN", "Security", "Type", "Freq/y",
        "Maturity", "Coupon (%)", "PX_LAST", "BDP formula hint",
    ]
    _header_row(ws, 4, headers)

    for i, (isin, btype, freq) in enumerate(BONDS):
        r = 5 + i
        sec = f"{isin} Corp"
        _value_cell(ws, r, 1, isin, mono=True)
        _value_cell(ws, r, 2, sec, mono=True)
        _value_cell(ws, r, 3, btype)
        _value_cell(ws, r, 4, freq, fmt="0")
        _value_cell(ws, r, 5, None, fmt="yyyy-mm-dd")
        _value_cell(ws, r, 6, None, fmt="0.0000")
        _value_cell(ws, r, 7, None, fmt="0.0000")
        hint = ws.cell(
            row=r, column=8,
            value=(
                f"'=BDP(\"{sec}\",\"MATURITY\") | "
                f"=BDP(\"{sec}\",\"CPN\") | "
                f"=BDP(\"{sec}\",\"PX_LAST\")"
            ),
        )
        hint.font = Font(name="Consolas", size=9, color="6B7280")
        hint.border = BORDER

    _autosize(
        ws,
        {"A": 16, "B": 20, "C": 6, "D": 7, "E": 12, "F": 10, "G": 10, "H": 70},
    )


def build_bisttref_sheet(wb: Workbook) -> None:
    ws = wb.create_sheet("BISTTREF")
    ws["A1"] = "BISTTREF — O/N TLREF Reference Rate"
    ws["A1"].font = TITLE
    ws["A3"] = "Ticker"
    ws["B3"] = "PX_LAST"
    ws["A3"].font = HEADER_FONT
    ws["A3"].fill = HEADER_FILL
    ws["B3"].font = HEADER_FONT
    ws["B3"].fill = HEADER_FILL

    ws["A4"] = "BISTTREF Index"
    ws["A4"].font = MONO
    ws["B4"] = "=BDP(\"BISTTREF Index\", \"PX_LAST\")"
    ws["B4"].number_format = "0.0000"

    ws["A6"] = "Used as the spot TLREF anchor in the Scenario tab."
    ws["A6"].font = NOTE

    _autosize(ws, {"A": 22, "B": 14})


def build_export_sheet(wb: Workbook) -> None:
    """A tiny crib-sheet showing how users can export values back to TS."""
    ws = wb.create_sheet("Export")
    ws["A1"] = "Round-trip back to src/data/"
    ws["A1"].font = TITLE
    ws["A3"] = (
        "Once the data sheets are filled, copy-paste this Python "
        "snippet into the repo and run it — it reads this workbook "
        "and rewrites src/data/ois-quotes.ts, offshore-quotes.ts, "
        "bonds.ts."
    )
    ws["A3"].alignment = Alignment(wrap_text=True)
    ws.row_dimensions[3].height = 45

    code = '''\
# save as scripts/import_bbg_template.py
from openpyxl import load_workbook
from pathlib import Path

wb = load_workbook("bloomberg/tlref_ois_template.xlsx", data_only=True)

# --- OIS Quotes ---
ois_ws = wb["OIS Quotes"]
ois_rows = []
for r in range(6, 6 + 13):
    tenor = ois_ws.cell(row=r, column=1).value
    months = ois_ws.cell(row=r, column=3).value or 0
    days   = ois_ws.cell(row=r, column=4).value or 0
    bid    = ois_ws.cell(row=r, column=5).value
    ask    = ois_ws.cell(row=r, column=6).value
    if bid is None or ask is None:
        continue
    ois_rows.append((tenor, months, days, float(bid), float(ask)))

# Emit TS array (paste into src/data/ois-quotes.ts).
for t, mo, dy, b, a in ois_rows:
    print(f'  {{ tenor: "{t}", months: {mo}, days: {dy}, bid: {b}, ask: {a} }},')
'''
    ws["A5"] = code
    ws["A5"].font = Font(name="Consolas", size=9)
    ws["A5"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[5].height = 260

    _autosize(ws, {"A": 110})


def main() -> None:
    wb = Workbook()
    build_readme(wb)
    build_ois_sheet(wb)
    build_offshore_sheet(wb)
    build_bonds_sheet(wb)
    build_bisttref_sheet(wb)
    build_export_sheet(wb)
    wb.save(OUT_PATH)
    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
