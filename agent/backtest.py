"""Command-line backtest: TabPFN vs naive baselines on the last N days of an order history.

  cd agent
  PRIORLABS_API_KEY=... python backtest.py --input history.json                 # prints a markdown table
  PRIORLABS_API_KEY=... python backtest.py --input history.json --holdout 14 \\
      --json ../docs/results/backtest.json --markdown ../docs/results/backtest.md

history.json is either a list of rows {date, hour, item, category, qty, price} or an object with a
"history" list (and optional "holidays", "festivals", "synthetic") — e.g. the file written by
`npm run prep:export` in the repo root. Without a TabPFN key the script exits; it never makes numbers up.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.backtest import BacktestError, run_backtest, to_markdown
from app.features import encode_history
from app.forecast import ForecasterNotConfigured, tabpfn_factory, tabpfn_token
from app.schemas import BacktestRequest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="history JSON file")
    ap.add_argument("--holdout", type=int, default=14, help="days to hold out (7–28, default 14)")
    ap.add_argument("--json", help="also write the full result as JSON here")
    ap.add_argument("--markdown", help="also write the markdown table here")
    args = ap.parse_args(argv)

    raw = json.loads(Path(args.input).read_text(encoding="utf-8"))
    payload = {"history": raw} if isinstance(raw, list) else raw
    req = BacktestRequest.model_validate({**payload, "holdout_days": args.holdout})
    if not tabpfn_token():
        print("PRIORLABS_API_KEY (or TABPFN_TOKEN) is not set — no backtest was run, no numbers produced.", file=sys.stderr)
        return 2
    enc = encode_history(req.history, req.holidays, req.festival_pairs())
    try:
        res = run_backtest(enc, tabpfn_factory, req.holdout_days)
    except (BacktestError, ForecasterNotConfigured) as err:
        print(f"Backtest not run: {err}", file=sys.stderr)
        return 2
    res = {"ran_at": datetime.now(timezone.utc).isoformat(), "input": args.input, "synthetic": req.synthetic, **res}
    md = to_markdown(res, synthetic=req.synthetic)
    print(md)
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps(res, indent=2), encoding="utf-8")
        print(f"\nWrote {args.json}")
    if args.markdown:
        Path(args.markdown).parent.mkdir(parents=True, exist_ok=True)
        Path(args.markdown).write_text(f"# Prep forecast backtest\n\nRun {res['ran_at']} on `{args.input}`.\n\n{md}\n", encoding="utf-8")
        print(f"Wrote {args.markdown}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
