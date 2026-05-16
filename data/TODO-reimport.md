# Data Re-import Instructions

## Steps to complete the data import:

### 1. Place the all-data.txt file
Copy the complete TSV data (from the Google Sheet export or the conversation document) 
into `expense-tracker/data/all-data.txt`.

The file format is tab-separated with columns:
```
Week Of Expenditure\tItem\tItem Bought?\tPrice
```

Example:
```
Sunday 26 May 2024\tMeat\t\t8,000.00
Sunday 26 May 2024\tStockFish\t\t2,200.00
```

### 2. Run the import script
```bash
cd expense-tracker
node scripts/reimport-all-data.mjs
```

This will:
- Delete all records with weekOf <= "2026-02-01" from DynamoDB
- Parse the all-data.txt file
- Classify items into the 5 categories (Food, Provision, Others, Mom's Drugs & Hosp. Exp, Dad's Drugs & Hosp. Exp)
- Import all entries with status 'approved' and purchased=true

### 3. Verify
Check the dashboard to confirm:
- Total should be approximately ₦8M
- Data spans from May 2024 to early 2026
- Categories are correctly assigned

## Code fixes applied in this session:
- ✅ Weekly/monthly filter fixed (monthly now captures all weeks overlapping the month)
- ✅ Weekly history status fixed (imported data without status field treated as approved)
- ✅ WhatsApp share button added on subsequent submissions (always visible when items are submitted/approved)
- ✅ Import script created with proper category matching
