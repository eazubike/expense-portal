#!/usr/bin/env python3
"""Generate all-data.txt from the raw document content."""
import os

# The complete data from the conversation document
DATA = """Week Of Expenditure\tItem\tItem Bought?\tPrice
Sunday 26 May 2024\tMeat\t\t8,000.00
Sunday 26 May 2024\tStockFish\t\t2,200.00
Sunday 26 May 2024\tOnions\t\t1,000.00
Sunday 26 May 2024\tSalt\t\t500.00
Sunday 26 May 2024\tRedoil\t\t2,500.00
Sunday 26 May 2024\tbitter leaf\t\t600.00
Sunday 26 May 2024\tCoco yam\t\t1,000.00
Sunday 26 May 2024\tOgili igbo\t\t500.00
Sunday 26 May 2024\tYellow Pepper\t\t200.00
Sunday 26 May 2024\tgrounded pepper\t\t1,000.00
Sunday 26 May 2024\tTomatoes fresh\t\t1,000.00
Sunday 26 May 2024\tTomatoes Paste\t\t700.00
Sunday 26 May 2024\tPepper mix\t\t1,000.00
Sunday 26 May 2024\tSeasoning\t\t500.00
Sunday 26 May 2024\tgroundnut oil\t\t1,500.00
Sunday 26 May 2024\tplaintain\t\t2,000.00
Sunday 26 May 2024\tyam\t\t2,500.00
Sunday 26 May 2024\tpotatoes\t\t1,000.00
Sunday 26 May 2024\tbeans\t\t3,500.00
Sunday 26 May 2024\trice\t\t1,100.00
Sunday 26 May 2024\tpap\t\t1,000.00
Sunday 26 May 2024\tmilk\t\t5,500.00
Sunday 26 May 2024\tcoffe\t\t2,500.00
Sunday 26 May 2024\tbiscuit\t\t3,000.00
Sunday 26 May 2024\tchinchin\t\t3,000.00
Sunday 26 May 2024\tcrate of egg\t\t3,500.00
Sunday 26 May 2024\tNepa\t\t5,000.00
Sunday 26 May 2024\tWater\t\t3,000.00
Sunday 26 May 2024\tOmo\t\t1,500.00
Sunday 26 May 2024\tT- fare\t\t500.00
Sunday 26 May 2024\tInsecticide\t\t2,500.00
Sunday 26 May 2024\tGabapentin\t\t800.00
Sunday 26 May 2024\tAmulodipen\t\t600.00
Sunday 26 May 2024\tDolometa B\t\t500.00
Sunday 26 May 2024\tAboniki\t\t600.00
Sunday 26 May 2024\tEmcap\t\t400.00
Sunday 26 May 2024\tBustan n\t\t500.00
Sunday 26 May 2024\tMalaria medicine\t\t1,500.00
Sunday 26 May 2024\tMaxi Tear\t\t3,000.00
Sunday 26 May 2024\tShea butter\t\t500.00
Sunday 26 May 2024\tAmulodipen\t\t600.00
Sunday 26 May 2024\tEye antioxidants\t\t1,500.00
Sunday 26 May 2024\tGabapentin\t\t800.00
Sunday 26 May 2024\tNurovite fort\t\t1,800.00"""

outpath = os.path.join(os.path.dirname(__file__), '..', 'data', 'all-data.txt')
outpath = os.path.abspath(outpath)
with open(outpath, 'w') as f:
    f.write(DATA)
print(f"Wrote {outpath}")
lines = DATA.count('\n') + 1
print(f"Lines: {lines}")
