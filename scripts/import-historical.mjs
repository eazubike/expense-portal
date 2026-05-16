/**
 * Import historical expense data into DynamoDB.
 *
 * Usage: node scripts/import-historical.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const TABLE_NAME = 'expense-tracker-entries-test';
const REGION = 'eu-west-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ---------------------------------------------------------------------------
// Category catalog for items without explicit category (first batch)
// ---------------------------------------------------------------------------
const FOOD_ITEMS = new Set([
  'Meat', 'Fresh Tomatoes', 'Grounded Pepper', 'Shombo', 'Fresh Pepper',
  'Onions', 'Curry', 'Thyme', 'Curry leaves', 'Palm Oil', 'Groundnut Oil',
  'Yam', 'Potatoes', 'Beans', 'Okpa', 'Pap', 'Bread', 'Ukpaka',
  'Green Vegetable (Spinach)', 'Nchuawu (Scent leave)', 'Egg', 'Garri',
  'Oha', 'Uziza', 'Uziza Seed', 'Crayfish', 'Cocoyam', 'Ogiri Idemili',
  'Onga', 'Okporoko', 'Dryfish', 'Titus/ Scumbia fish', 'Cucumber',
  'Oranges', 'Banana', 'Pineapple', 'Ginger', 'Garlic', 'Tin Tomatoes',
]);

const PROVISION_ITEMS = new Set([
  'Milk', 'Ovaltine', 'Mayonnaise', 'Quaker Oats', 'Honey',
]);

const OTHERS_ITEMS = new Set([
  'Entrance Key Hole Change', 'Prepaid Meter Recharge',
  'Electrical works and fittings', 'Markintosh', 'Adult Diaper',
  'Sealing Bottom of Entrance Door + Labour', 'Omo', 'Gotv',
  'Toilet Cleaner', 'Bleach', 'Insecticide', 'Air Freshener',
  'Toothpaste', 'Bathing Soap', 'Dustbin Nylon', 'Gas', 'Pure water',
  'Bowls for storing soup and stew in freezer', 'Plate Basket',
  'Rope for spreading clothes', 'Small dustbin',
]);

function lookupCategory(itemName) {
  if (FOOD_ITEMS.has(itemName)) return 'Food';
  if (PROVISION_ITEMS.has(itemName)) return 'Provision';
  if (OTHERS_ITEMS.has(itemName)) return 'Others';
  throw new Error(`Unknown category for item: "${itemName}"`);
}

function parsePrice(priceStr) {
  return Number(priceStr.replace(/,/g, ''));
}

// ---------------------------------------------------------------------------
// Historical data
// ---------------------------------------------------------------------------

// Week 1: Sunday 22 February 2026
const week1_noCategory = `Entrance Key Hole Change,5000|Prepaid Meter Recharge,10000|Electrical works and fittings,25200|Markintosh,6000|Adult Diaper,7500|Sealing Bottom of Entrance Door + Labour,5000|Omo,2000|Gotv,4000|Toilet Cleaner,1200|Bleach,1000|Insecticide,1700|Air Freshener,600|Toothpaste,2000|Bathing Soap,1500|Dustbin Nylon,1200|Gas,13800|Pure water,4000|Bowls for storing soup and stew in freezer,4600|Plate Basket,2000|Rope for spreading clothes,1000|Meat,15000|Fresh Tomatoes,3000|Grounded Pepper,600|Shombo,2000|Fresh Pepper,200|Onions,1000|Curry,600|Thyme,500|Curry leaves,200|Palm Oil,2000|Groundnut Oil,2000|Yam,2600|Potatoes,1500|Beans,4500|Okpa,3000|Pap,1000|Bread,1500|Milk,1300|Ovaltine,1800|Ukpaka,500|Green Vegetable (Spinach),500|Nchuawu (Scent leave),200|Egg,3000|Garri,1500|Oha,600|Uziza,400|Uziza Seed,200|Crayfish,2200|Cocoyam,2000|Ogiri Idemili,1000|Onga,400|Okporoko,2000|Dryfish,2000|Titus/ Scumbia fish,2000|Small dustbin,700|Cucumber,1000|Oranges,500|Banana,2000|Pineapple,500|Ginger,500|Garlic,400|Tin Tomatoes,1600`;

const week1_withCategory = `Provision,Mayonnaise,1300|Provision,Quaker Oats,2000|Provision,Honey,2500`;

// Week 2: Wednesday 4 March 2026 → weekOf: 2026-03-02
const week2 = `Others,3 Watt bulb,1800|Others,Toothbrushes,600|Others,Kettle,5500|Others,Painter buckets for urinating,2400|Provision,Milk,3200|Provision,Ovaltine,3500|Food,Groundnut Oil,2000|Others,Knife,1200|Food,Potatoes,1000|Food,Pap,1000|Food,Okpa,3000|Food,Fresh Tomatoes,1000|Food,Moimoi,1000|Food,Bread,1500|Food,Ukpaka,600|Food,Vegetables,1000|Food,Egg,3000|Food,Fruits,2000|Others,Curtain hanger,2000|Mom's Drugs & Hosp. Exp,Vitamin E,900|Mom's Drugs & Hosp. Exp,Neurovite Forte,2575|Mom's Drugs & Hosp. Exp,Brustan N,650|Mom's Drugs & Hosp. Exp,Gabapentin,2800|Mom's Drugs & Hosp. Exp,Atorvastatin,1275|Mom's Drugs & Hosp. Exp,Amlodipine 10mg,900|Mom's Drugs & Hosp. Exp,Amitriptyline,1500|Mom's Drugs & Hosp. Exp,Eye Antioxidant,2500|Mom's Drugs & Hosp. Exp,Maxi Tears,3250|Mom's Drugs & Hosp. Exp,Paracetamol,500|Mom's Drugs & Hosp. Exp,Amartem Soft gel + Panadol,3300|Mom's Drugs & Hosp. Exp,Aboniki,2000|Mom's Drugs & Hosp. Exp,Hospital Registration,3000|Mom's Drugs & Hosp. Exp,Folder fee/ Consultant visit,4000|Dad's Drugs & Hosp. Exp,Neurovite Forte,2575|Dad's Drugs & Hosp. Exp,Amlodipine 5mg,750|Dad's Drugs & Hosp. Exp,Vitamin E,900|Dad's Drugs & Hosp. Exp,Micropost Eyedrop,7500|Dad's Drugs & Hosp. Exp,Brimosopt Eyedrops,2600|Dad's Drugs & Hosp. Exp,Atorvastatin,1275|Dad's Drugs & Hosp. Exp,Yeast,200|Dad's Drugs & Hosp. Exp,Vitamin C,1500|Dad's Drugs & Hosp. Exp,Vasoprin,400|Dad's Drugs & Hosp. Exp,Ocefix,3400|Dad's Drugs & Hosp. Exp,Amartem Soft gel + Panadol,3300|Dad's Drugs & Hosp. Exp,Multivitamin Tablets,200|Dad's Drugs & Hosp. Exp,Paracetamol,500|Dad's Drugs & Hosp. Exp,Hospital Registration,3000|Dad's Drugs & Hosp. Exp,Folder fee/ Consultant visit,4000|Dad's Drugs & Hosp. Exp,Urine test,1140|Dad's Drugs & Hosp. Exp,Blood test,42500|Dad's Drugs & Hosp. Exp,EEG test,25000|Dad's Drugs & Hosp. Exp,Renting of wheelchair,2000|Dad's Drugs & Hosp. Exp,Nosemasks,500|Dad's Drugs & Hosp. Exp,Barbing hair,1000`;

// Week 3: Tuesday 17 March 2026 → weekOf: 2026-03-16
const week3 = `Mom's Drugs & Hosp. Exp,Zentel,1500|Mom's Drugs & Hosp. Exp,Vitamin C,1500|Mom's Drugs & Hosp. Exp,Ferrous Sulphate,150|Mom's Drugs & Hosp. Exp,Amlodipine 10mg,1600|Mom's Drugs & Hosp. Exp,Aboniki,2200|Mom's Drugs & Hosp. Exp,Neurovite Forte,1750|Mom's Drugs & Hosp. Exp,Atorvastatin,1275|Mom's Drugs & Hosp. Exp,Vitamin E,900|Mom's Drugs & Hosp. Exp,Amitriptyline,600|Mom's Drugs & Hosp. Exp,Lady Sept Pad (for urinary incontinence),1500|Mom's Drugs & Hosp. Exp,Lab blood test,5000|Mom's Drugs & Hosp. Exp,Brustan N,500|Dad's Drugs & Hosp. Exp,Zentel,1500|Dad's Drugs & Hosp. Exp,Vitamin C,1500|Dad's Drugs & Hosp. Exp,Ferrous Sulphate,150|Dad's Drugs & Hosp. Exp,Epilim Chrono,9000|Dad's Drugs & Hosp. Exp,Nootropil,5350|Dad's Drugs & Hosp. Exp,Cefpodoxime/ Clauvanic acid,7500|Dad's Drugs & Hosp. Exp,Atorvastatin,1275|Dad's Drugs & Hosp. Exp,Vitamin E,900|Dad's Drugs & Hosp. Exp,Neurovite Forte,1750|Dad's Drugs & Hosp. Exp,Consultation fee,2500|Dad's Drugs & Hosp. Exp,File,200|Dad's Drugs & Hosp. Exp,Oaklife,7500|Dad's Drugs & Hosp. Exp,Brain Formula,7800|Dad's Drugs & Hosp. Exp,Pharmacy Service Charge,50|Others,Omo,2000|Food,Pap,1000|Others,Moimoi,1000|Others,Okpa,3000|Others,Bread,1500|Others,Broom,500|Others,Battery for Dad's Radio,1400|Food,Tin Tomatoes,1600|Food,Yam,2600|Food,Oranges,1000|Provision,Milk,3200|Provision,Ovaltine,3500|Others,Pure water,3500|Provision,Mayonnaise,1300|Provision,Honey,2500|Food,Fresh Tomatoes,1000|Food,Onions,1000|Food,Garden Egg,500|Food,Cucumber,500|Food,Titus/ Scumbia fish,3000`;

// Week 4: Saturday 28 March 2026 → weekOf: 2026-03-23
const week4 = `Mom's Drugs & Hosp. Exp,X-ray,60000|Mom's Drugs & Hosp. Exp,Amlodipine 10mg,1600|Mom's Drugs & Hosp. Exp,Gabapentin,2800|Mom's Drugs & Hosp. Exp,Pregabalin,2400|Mom's Drugs & Hosp. Exp,Vitamin C,1500|Mom's Drugs & Hosp. Exp,Vitamin E,900|Mom's Drugs & Hosp. Exp,Ferrous Sulphate,300|Mom's Drugs & Hosp. Exp,Eye Antioxidant,2500|Mom's Drugs & Hosp. Exp,Paracetamol,500|Mom's Drugs & Hosp. Exp,Brustan N,500|Mom's Drugs & Hosp. Exp,Escitalopram,3750|Mom's Drugs & Hosp. Exp,Atorvastatin,1275|Mom's Drugs & Hosp. Exp,Neurovite Forte,1750|Dad's Drugs & Hosp. Exp,Epilim Chrono 500,9000|Dad's Drugs & Hosp. Exp,Atorvastatin,1275|Dad's Drugs & Hosp. Exp,Brain Formula,7800|Dad's Drugs & Hosp. Exp,Neurovite Forte,1750|Dad's Drugs & Hosp. Exp,Multivitamin small tablets,200|Dad's Drugs & Hosp. Exp,Vitamin C,1500|Dad's Drugs & Hosp. Exp,Ferrous Sulphate,300|Dad's Drugs & Hosp. Exp,Oaklife,3750|Dad's Drugs & Hosp. Exp,Vitamin E,900|Others,Tanker water,18000|Food,Meat,15000|Food,Akwu (Palm fruit),4000|Food,Okporoko,4000|Food,Dryfish,4000|Food,Onions,2000|Food,Potatoes,2000|Food,Egg,3000|Food,Titus/ Scumbia fish,4500|Food,Egusi,4000|Food,Bitter Leaf,700|Food,Onga,400|Food,Maggi,500|Food,Nchuawu (Scent leave),500|Food,Ugu,500|Food,Fresh Pepper,200|Food,Okpei,600|Food,Crayfish,2500|Food,Palm Oil,2000|Food,Dry pepper,1000|Food,Pap,2000|Food,Akara,2000|Food,Moimoi,2000|Food,Okpa,3000|Food,Bread,3000|Provision,Quaker Oats,2000|Food,Tin Tomatoes,1600|Others,Toothbrushes,300|Others,Gas,6600|Provision,Milk,3200|Provision,Ovaltine,3500`;

// Week 5: Wednesday 15 April 2026 → weekOf: 2026-04-12
const week5 = `Others,Body Lotion,3165|Others,Comb,800|Others,Adult Diaper,7800|Others,Pure water,4000|Others,Nanny lab test,15500|Others,Nanny transport,3000|Food,Garri (White),1100|Food,Egg,3250|Food,Okpa,4000|Food,Akara,2000|Food,Moimoi,2000|Food,Pap,2000|Food,Yam,4000|Food,Bread,3000|Food,Fruits,3000|Provision,Milk,3200|Provision,Ovaltine,3500|Mom's Drugs & Hosp. Exp,Hospital Fee for Mum,4000|Mom's Drugs & Hosp. Exp,HbA1c sugar test for mum,10400|Mom's Drugs & Hosp. Exp,Gabapentin (3 satchets),6400|Mom's Drugs & Hosp. Exp,Neurovite Forte,1700|Mom's Drugs & Hosp. Exp,Amlodipine 10mg,700|Mom's Drugs & Hosp. Exp,Pregabalin,1600|Mom's Drugs & Hosp. Exp,Amitriptyline,1200|Mom's Drugs & Hosp. Exp,Marcgesic tablet,700|Mom's Drugs & Hosp. Exp,Vitamin E,700|Mom's Drugs & Hosp. Exp,Ferrous Sulphate,75|Mom's Drugs & Hosp. Exp,Vitamin C,150|Mom's Drugs & Hosp. Exp,Multivitamin small tablets,150|Mom's Drugs & Hosp. Exp,Shea Butter,1000|Mom's Drugs & Hosp. Exp,Paracetamol,800|Mom's Drugs & Hosp. Exp,Aboniki,2000|Dad's Drugs & Hosp. Exp,Nootropil,5350|Dad's Drugs & Hosp. Exp,Epilim Chrono 500,8500|Dad's Drugs & Hosp. Exp,Vasoprin,100|Dad's Drugs & Hosp. Exp,Neurovite Forte,1700|Dad's Drugs & Hosp. Exp,Vitamin E,700|Dad's Drugs & Hosp. Exp,Ferrous Sulphate,75|Dad's Drugs & Hosp. Exp,Oaklife Vitamin D3+K2,2000|Dad's Drugs & Hosp. Exp,Vitamin C,150|Dad's Drugs & Hosp. Exp,Multivitamin small tablets,150|Dad's Drugs & Hosp. Exp,Ibuprophen,400`;

// ---------------------------------------------------------------------------
// Parse entries
// ---------------------------------------------------------------------------

function parseWithCategory(raw, weekOf) {
  return raw.split('|').map((segment) => {
    const parts = segment.trim().split(',');
    // Format: category,item,price
    const price = parsePrice(parts[parts.length - 1]);
    const category = parts[0].trim();
    const item = parts.slice(1, -1).join(',').trim();
    return buildEntry(weekOf, category, item, price);
  });
}

function parseWithoutCategory(raw, weekOf) {
  return raw.split('|').map((segment) => {
    const parts = segment.trim().split(',');
    // Format: item,price (item may contain commas — price is always last)
    const price = parsePrice(parts[parts.length - 1]);
    const item = parts.slice(0, -1).join(',').trim();
    const category = lookupCategory(item);
    return buildEntry(weekOf, category, item, price);
  });
}

function buildEntry(weekOf, category, item, price) {
  const now = new Date().toISOString();
  return {
    weekOf,
    entryId: randomUUID(),
    category,
    item,
    price,
    status: 'approved',
    purchased: true,
    createdBy: 'import',
    createdByName: 'Historical Import',
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// DynamoDB operations
// ---------------------------------------------------------------------------

async function deleteAllItems() {
  console.log('Scanning table for existing items to delete...');
  let totalDeleted = 0;
  let lastEvaluatedKey;

  do {
    const scanParams = {
      TableName: TABLE_NAME,
      ProjectionExpression: 'weekOf, entryId',
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    };

    const result = await docClient.send(new ScanCommand(scanParams));
    const items = result.Items || [];
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (items.length === 0) continue;

    // BatchWrite supports max 25 items per request
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      const deleteRequests = batch.map((item) => ({
        DeleteRequest: {
          Key: { weekOf: item.weekOf, entryId: item.entryId },
        },
      }));

      await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: deleteRequests },
        })
      );
      totalDeleted += batch.length;
    }
  } while (lastEvaluatedKey);

  if (totalDeleted > 0) {
    console.log(`Deleted ${totalDeleted} existing items.`);
  } else {
    console.log('Table is empty, nothing to delete.');
  }
}

async function writeEntries(entries) {
  // BatchWrite supports max 25 items per request
  for (let i = 0; i < entries.length; i += 25) {
    const batch = entries.slice(i, i + 25);
    const putRequests = batch.map((item) => ({
      PutRequest: { Item: item },
    }));

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: putRequests },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Importing historical data into ${TABLE_NAME}...\n`);

  // Step 1: Delete existing items
  await deleteAllItems();
  console.log('');

  // Step 2: Build all entries
  const allEntries = [];

  // Week 1: 2026-02-22
  const w1 = [
    ...parseWithoutCategory(week1_noCategory, '2026-02-22'),
    ...parseWithCategory(week1_withCategory, '2026-02-22'),
  ];
  console.log(`Importing week 2026-02-22: ${w1.length} items...`);
  allEntries.push(...w1);

  // Week 2: 2026-03-02
  const w2 = parseWithCategory(week2, '2026-03-02');
  console.log(`Importing week 2026-03-02: ${w2.length} items...`);
  allEntries.push(...w2);

  // Week 3: 2026-03-16
  const w3 = parseWithCategory(week3, '2026-03-16');
  console.log(`Importing week 2026-03-16: ${w3.length} items...`);
  allEntries.push(...w3);

  // Week 4: 2026-03-23
  const w4 = parseWithCategory(week4, '2026-03-23');
  console.log(`Importing week 2026-03-23: ${w4.length} items...`);
  allEntries.push(...w4);

  // Week 5: 2026-04-12
  const w5 = parseWithCategory(week5, '2026-04-12');
  console.log(`Importing week 2026-04-12: ${w5.length} items...`);
  allEntries.push(...w5);

  console.log(`\nWriting ${allEntries.length} total entries to DynamoDB...`);

  // Step 3: Write to DynamoDB
  await writeEntries(allEntries);

  console.log(`\nDone! Successfully imported ${allEntries.length} entries.`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
