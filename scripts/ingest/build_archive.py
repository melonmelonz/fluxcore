#!/usr/bin/env python3
"""Build monthly archive chunks from cached annual ERCOT SPP frames.

Output: public/data/archive/{hub}/{YYYY-MM}.json with the same PricePoint
schema the app already uses ({t: epoch-ms, price: $/MWh}), plus an index.
Annual frames are cached as pickles in /tmp (downloaded once if missing).
"""
import json
import pathlib

import pandas as pd

OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "data" / "archive"
CACHE = pathlib.Path("/tmp")
HUBS = ["HB_NORTH", "HB_HOUSTON", "HB_WEST", "HB_SOUTH"]
YEARS = [2023, 2024]


def annual(market: str, year: int) -> pd.DataFrame:
    path = CACHE / f"ercot_{market}_{year}.pkl"
    if path.exists():
        return pd.read_pickle(path)
    import gridstatus
    iso = gridstatus.Ercot()
    df = iso.get_rtm_spp(year) if market == "rtm" else iso.get_dam_spp(year)
    df.to_pickle(path)
    return df


def points(df: pd.DataFrame) -> list:
    return sorted(
        ({"t": int(ts.timestamp() * 1000), "price": round(float(p), 2)}
         for ts, p in zip(df["Interval Start"], df["SPP"])),
        key=lambda p: p["t"],
    )


def main():
    months = set()
    for year in YEARS:
        rtm = annual("rtm", year)
        dam = annual("dam", year)
        for hub in HUBS:
            hub_rtm = rtm[rtm["Location"] == hub].copy()
            hub_dam = dam[dam["Location"] == hub].copy()
            hub_rtm["month"] = hub_rtm["Interval Start"].dt.strftime("%Y-%m")
            hub_dam["month"] = hub_dam["Interval Start"].dt.strftime("%Y-%m")
            out_dir = OUT / hub
            out_dir.mkdir(parents=True, exist_ok=True)
            for month, r in hub_rtm.groupby("month"):
                d = hub_dam[hub_dam["month"] == month]
                chunk = {"hub": hub, "month": month,
                         "rtm": points(r), "dam": points(d)}
                (out_dir / f"{month}.json").write_text(
                    json.dumps(chunk, separators=(",", ":")))
                months.add(month)
                print(f"{hub} {month}: rtm={len(chunk['rtm'])} dam={len(chunk['dam'])}")
    (OUT / "index.json").write_text(json.dumps(
        {"hubs": HUBS, "months": sorted(months)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
