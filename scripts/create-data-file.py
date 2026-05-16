#!/usr/bin/env python3
"""
Helper script to remind user to place the all-data.txt file.
The data file should be copied from the source (Google Sheet export)
into expense-tracker/data/all-data.txt

The file format is TSV with columns:
  Week Of Expenditure | Item | Item Bought? | Price

To export from Google Sheets:
1. Open the sheet
2. File > Download > Tab-separated values (.tsv)
3. Rename to all-data.txt and place in expense-tracker/data/
"""

import os
import sys

data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'all-data.txt')
data_path = os.path.abspath(data_path)

if os.path.exists(data_path):
    size = os.path.getsize(data_path)
    with open(data_path, 'r') as f:
        lines = f.readlines()
    print(f"all-data.txt exists: {len(lines)} lines, {size} bytes")
    if size < 10000:
        print("WARNING: File seems too small. Expected ~100KB+ for full historical data.")
        print("Please replace with the complete data file.")
else:
    print(f"all-data.txt NOT FOUND at: {data_path}")
    print("Please place the complete data file there.")

sys.exit(0)
