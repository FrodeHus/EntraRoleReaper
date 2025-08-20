#!/usr/bin/env python3
"""
Extract all Microsoft Entra audit activity tables and save to JSON.

Outputs array of:
{
  "Service": "<heading above the table>",
  "Audit category": "<table cell>",
  "Activity": "<table cell>"
}

Usage examples:
  python extract_entra_audit_tables.py \
      --source "https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-audit-activities?source=docs" \
      --out entra_audit_activities.json

  # If the site blocks you, save the page as HTML (File > Save Page As) and run:
  python extract_entra_audit_tables.py --source ./reference-audit-activities.html
"""

import argparse
import json
import os
import sys
import time
import re
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup, Tag

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
}

HEADING_TAGS = ["h2", "h3", "h4"]  # use the nearest title above the table


def fetch_html(source: str, retries: int = 3, backoff: float = 1.5) -> str:
    if os.path.exists(source):
        with open(source, "r", encoding="utf-8") as f:
            return f.read()

    last_err = None
    for attempt in range(retries):
        try:
            resp = requests.get(source, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.text
            last_err = RuntimeError(f"HTTP {resp.status_code}")
        except Exception as e:
            last_err = e
        time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"Failed to fetch HTML from {source}: {last_err}")


def nearest_heading_above(node: Tag) -> Optional[str]:
    # Walk backwards in document order to find the closest heading
    for prev in node.find_all_previous():
        if isinstance(prev, Tag) and prev.name in HEADING_TAGS:
            text = " ".join(prev.get_text(" ", strip=True).split())
            if text:
                return text
    return None


def normalize(text: str) -> str:
    # Collapse whitespace and remove non-breaking spaces
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def header_map_from_table(table: Tag) -> Dict[str, int]:
    """
    Try to detect columns by header text (case-insensitive).
    Returns a mapping like {'audit category': 0, 'activity': 1}
    """
    # Find header row (prefer the first <thead> row, else first <tr>)
    header_cells = []
    thead = table.find("thead")
    if thead:
        tr = thead.find("tr")
        if tr:
            header_cells = tr.find_all(["th", "td"])
    if not header_cells:
        # fallback to first row that contains TH
        tr = table.find("tr")
        if tr:
            ths = tr.find_all("th")
            if ths:
                header_cells = ths
            else:
                # If no TH, treat first row as header if it looks like headers
                header_cells = tr.find_all("td")

    headers = [normalize(h.get_text(" ", strip=True)).lower() for h in header_cells]
    col_map = {}

    # Look for direct matches
    for idx, h in enumerate(headers):
        if "audit category" in h or h == "auditcategory":
            col_map["audit category"] = idx
        if h == "activity" or " activity" in h or h.endswith("activity"):
            col_map["activity"] = idx

    # If not found, try fuzzy heuristics
    if "audit category" not in col_map:
        for idx, h in enumerate(headers):
            if "audit" in h and "categor" in h:
                col_map["audit category"] = idx
                break

    if "activity" not in col_map:
        for idx, h in enumerate(headers):
            if "activity" in h:
                col_map["activity"] = idx
                break

    # If still missing and table has exactly 2 columns, assume 0/1
    if ("audit category" not in col_map or "activity" not in col_map) and header_cells:
        # Count columns by the *first data row*
        first_data_row = None
        all_rows = table.find_all("tr")
        if len(all_rows) >= 2:
            first_data_row = all_rows[1]
        if first_data_row:
            cols = first_data_row.find_all(["td", "th"])
            if len(cols) == 2:
                col_map.setdefault("audit category", 0)
                col_map.setdefault("activity", 1)

    return col_map


def row_cells(tr: Tag) -> List[str]:
    tds = tr.find_all(["td", "th"])
    return [normalize(td.get_text(" ", strip=True)) for td in tds]


def extract_table_records(table: Tag, service: str) -> List[Dict[str, str]]:
    records: List[Dict[str, str]] = []

    # Build column map
    col_map = header_map_from_table(table)

    # Iterate over rows after the header row
    rows = table.find_all("tr")
    if not rows:
        return records

    # Identify header row index: 0 if the first row looks like header
    header_idx = 0
    if table.find("thead"):
        # assume first thead row is header
        header_idx = 0
    else:
        # if first row has THs, treat as header
        ths = rows[0].find_all("th")
        if not ths:
            # some tables have no explicit headers; still treat row 0 as header-like
            pass

    for tr in rows[header_idx + 1 :]:
        cells = row_cells(tr)
        if not cells or all(not c for c in cells):
            continue

        # Resolve indices
        ac_idx = col_map.get("audit category")
        act_idx = col_map.get("activity")

        # If columns still unknown, try positional fallback
        if ac_idx is None or act_idx is None:
            if len(cells) >= 2:
                ac_idx = ac_idx if ac_idx is not None else 0
                act_idx = act_idx if act_idx is not None else 1

        if ac_idx is None or act_idx is None:
            # Can't parse this row reliably; skip it
            continue

        audit_category = cells[ac_idx] if ac_idx < len(cells) else ""
        activity = cells[act_idx] if act_idx < len(cells) else ""

        if not audit_category and not activity:
            continue

        records.append(
            {
                "Service": service,
                "Audit category": audit_category,
                "Activity": activity,
            }
        )

    return records


def parse_all_tables(html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")

    # Some Learn pages wrap main content in role="main"
    main = soup.find(attrs={"role": "main"}) or soup
    tables = main.find_all("table")
    results: List[Dict[str, str]] = []

    for tbl in tables:
        service = nearest_heading_above(tbl) or "Untitled Section"
        # Only keep tables that plausibly contain the columns we need
        recs = extract_table_records(tbl, service)
        if recs:
            results.extend(recs)

    return results


def main():
    ap = argparse.ArgumentParser(
        description="Extract Entra audit activity tables to JSON."
    )
    ap.add_argument(
        "--source",
        required=True,
        help="URL of the Learn page or path to a saved HTML file.",
    )
    ap.add_argument(
        "--out",
        default="entra_audit_activities.json",
        help="Output JSON file path (default: entra_audit_activities.json)",
    )
    args = ap.parse_args()

    html = fetch_html(args.source)
    records = parse_all_tables(html)

    # Save JSON
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"Extracted {len(records)} rows into {args.out}")


if __name__ == "__main__":
    main()
