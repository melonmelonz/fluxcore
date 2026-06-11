#!/usr/bin/env python3
"""One-time ingest: real ERCOT HB_NORTH prices -> bundled scenario JSON.

Uses ERCOT's annual historical SPP archives (NP6-785-ER / NP4-180-ER) via
gridstatus, slices one-week windows, and writes scenario JSON for the app.
Annual frames are cached as pickles in /tmp to avoid re-downloading.
"""
import json
import pathlib
import sys

import pandas as pd

OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "data"
CACHE = pathlib.Path("/tmp")

SCENARIOS = [
    {"id": "heatwave-2023", "name": "Heat Wave / Aug 2023", "season": "summer",
     "description": "ERCOT HB_NORTH, the violent August 2023 Texas heat wave.",
     "year": 2023, "start": "2023-08-14", "end": "2023-08-21"},
    {"id": "shoulder-2024", "name": "Shoulder Season / Apr 2024", "season": "shoulder",
     "description": "ERCOT HB_NORTH, a calm April 2024 week.",
     "year": 2024, "start": "2024-04-08", "end": "2024-04-15"},
    {"id": "winter-2024", "name": "Winter Storm Heather / Jan 2024", "season": "winter",
     "description": "ERCOT HB_NORTH, Winter Storm Heather, January 2024.",
     "year": 2024, "start": "2024-01-14", "end": "2024-01-21"},
]

LOCATION = "HB_NORTH"


def annual(market: str, year: int) -> pd.DataFrame:
    """Load an annual SPP frame, downloading and caching it if needed."""
    path = CACHE / f"ercot_{market}_{year}.pkl"
    if path.exists():
        return pd.read_pickle(path)
    import gridstatus
    iso = gridstatus.Ercot()
    df = iso.get_rtm_spp(year) if market == "rtm" else iso.get_dam_spp(year)
    df.to_pickle(path)
    return df


def points(df: pd.DataFrame, start: str, end: str) -> list:
    df = df[(df["Location"] == LOCATION)]
    tz = df["Interval Start"].dt.tz
    lo = pd.Timestamp(start, tz=tz)
    hi = pd.Timestamp(end, tz=tz)
    df = df[(df["Interval Start"] >= lo) & (df["Interval Start"] < hi)]
    return sorted(
        ({"t": int(ts.timestamp() * 1000), "price": round(float(p), 2)}
         for ts, p in zip(df["Interval Start"], df["SPP"])),
        key=lambda p: p["t"],
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for s in SCENARIOS:
        doc = {
            "id": s["id"], "name": s["name"], "description": s["description"],
            "season": s["season"], "intervalMinutes": 15,
            "rtm": points(annual("rtm", s["year"]), s["start"], s["end"]),
            "dam": points(annual("dam", s["year"]), s["start"], s["end"]),
        }
        if len(doc["rtm"]) < 600 or len(doc["dam"]) < 160:
            sys.exit(f"{s['id']}: too few points rtm={len(doc['rtm'])} dam={len(doc['dam'])}")
        (OUT / f"{s['id']}.json").write_text(json.dumps(doc))
        index.append({"id": s["id"], "name": s["name"]})
        print(s["id"], "rtm:", len(doc["rtm"]), "dam:", len(doc["dam"]))
    (OUT / "index.json").write_text(json.dumps(index))


if __name__ == "__main__":
    main()
