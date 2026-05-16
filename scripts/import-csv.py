#!/usr/bin/env python3
"""Import historical data from CSV into DynamoDB prod table."""
import boto3, csv, re, sys
from datetime import datetime, timedelta
from uuid import uuid4
from decimal import Decimal

region = 'eu-west-1'
table_name = 'expense-tracker-entries-prod'
dynamodb = boto3.resource('dynamodb', region_name=region)
table = dynamodb.Table(table_name)

def parse_week_of(date_str):
    date_str = date_str.strip()
    date_str = re.sub(r'^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+', '', date_str, flags=re.IGNORECASE)
    date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str, flags=re.IGNORECASE)
    for fmt in ['%d %B %Y', '%d %b %Y']:
        try:
            dt = datetime.strptime(date_str, fmt)
            days_since_sunday = (dt.weekday() + 1) % 7
            sunday = dt - timedelta(days=days_since_sunday)
            return sunday.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None

def parse_price(price_str):
    price_str = str(price_str).strip().replace(',', '').replace('"', '')
    try:
        return Decimal(str(float(price_str)))
    except:
        return Decimal('0')

csv_path = sys.argv[1] if len(sys.argv) > 1 else '/Users/eazubike/Documents/Projects/Practice/vibe-code/expense-tracker/data/historical-load.csv'

print(f"Reading {csv_path}...")
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    entries = []
    now = datetime.utcnow().isoformat() + 'Z'
    for row in reader:
        date_str = row.get('Week Of Expenditure', '').strip()
        item = row.get('Item', '').strip()
        category = row.get('Category', '').strip()
        price_str = row.get('Price', '0').strip()
        if not date_str or not item or not price_str:
            continue
        week_of = parse_week_of(date_str)
        if not week_of:
            print(f"  WARN: bad date: {date_str}")
            continue
        price = parse_price(price_str)
        if price <= 0:
            continue
        if category == 'Dads Drugs & Hosp. Exp':
            category = "Dad's Drugs & Hosp. Exp"
        elif category in ('0', 'M', 'Water'):
            category = 'Others'
        entries.append({
            'weekOf': week_of,
            'entryId': str(uuid4()),
            'category': category,
            'item': item,
            'price': price,
            'status': 'approved',
            'purchased': True,
            'createdBy': 'import',
            'createdByName': 'Historical Import',
            'createdAt': now,
            'updatedAt': now,
        })

print(f"Parsed {len(entries)} entries across {len(set(e['weekOf'] for e in entries))} weeks.")
total = sum(float(e['price']) for e in entries)
print(f"Total: N{total:,.0f}")

print("Writing to DynamoDB...")
with table.batch_writer() as batch:
    for i, entry in enumerate(entries):
        batch.put_item(Item=entry)
        if (i+1) % 200 == 0:
            print(f"  {i+1}/{len(entries)}...")

print(f"Done! Imported {len(entries)} entries.")
