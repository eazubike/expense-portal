#!/bin/bash
# Paste the all-data.txt content into the data directory.
# 
# Usage:
#   1. Copy the full TSV content from the Google Sheet or conversation
#   2. Run: pbpaste > data/all-data.txt
#   3. Verify: wc -l data/all-data.txt (should be ~1800+ lines)
#   4. Run import: node scripts/reimport-all-data.mjs

echo "=== Paste Data Helper ==="
echo ""
echo "To create the data file, run one of these:"
echo ""
echo "  Option 1 (from clipboard):"
echo "    pbpaste > data/all-data.txt"
echo ""
echo "  Option 2 (from a file):"
echo "    cp /path/to/exported-sheet.tsv data/all-data.txt"
echo ""
echo "Then run the import:"
echo "    node scripts/reimport-all-data.mjs"
echo ""

if [ -f "data/all-data.txt" ]; then
    LINES=$(wc -l < data/all-data.txt)
    SIZE=$(wc -c < data/all-data.txt)
    echo "Current data/all-data.txt: $LINES lines, $SIZE bytes"
    if [ "$LINES" -lt 100 ]; then
        echo "WARNING: File seems incomplete (expected 1800+ lines)"
    else
        echo "File looks good!"
    fi
else
    echo "data/all-data.txt does not exist yet."
fi
