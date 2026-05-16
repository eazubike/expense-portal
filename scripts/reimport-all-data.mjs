/**
 * Re-import ALL historical expense data from all-data.txt into DynamoDB.
 *
 * This script:
 * 1. Deletes all records with weekOf <= "2026-02-01" from the entries table
 * 2. Parses the all-data.txt file and imports all entries
 *
 * Categories match the app catalog exactly:
 *   - "Food"
 *   - "Provision"
 *   - "Others"
 *   - "Mom's Drugs & Hosp. Exp"
 *   - "Dad's Drugs & Hosp. Exp"
 *
 * Usage: node scripts/reimport-all-data.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLE_NAME = 'expense-tracker-entries-test';
const REGION = 'eu-west-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ---------------------------------------------------------------------------
// Category classification using the exact app catalog items
// ---------------------------------------------------------------------------

// Food items (from ITEM_CATALOG["Food"]) - lowercase for matching
const FOOD_ITEMS = new Set([
  'abacha', 'achi', 'akara', 'aku', 'akwu', 'akwu (palm fruit)',
  'anyara leaf', 'anyara', 'banana', 'beans', 'bitter leaf', 'bread',
  'cabbage', 'cameroon pepper', 'carrot', 'chicken', 'chinchin',
  'cocoyam', 'coco yam', 'crayfish', 'cray fish', 'cucumber', 'curry',
  'curry leaves', 'dry pepper', 'dryfish', 'dry fish', 'efo',
  'egg', 'crate of egg', 'half crate eggs', 'half crate of egg', 'egg half',
  'egusi', 'ehuru', 'e hutu', 'ejakika', 'eru',
  'fish', 'fresh fish', 'cat fish', 'catfish',
  'fresh pepper', 'fresh tomatoes', 'frest pepper', 'frest tomatoes',
  'fruits', 'fruit', 'fruits and veggies', 'fruits and vegetables',
  'garden egg', 'garlic', 'garri', 'gari', 'garri half', 'garri half paint',
  'garri (white)', 'garri painter', 'garri half painter',
  'ginger', 'green beans', 'green', 'green vegetable (spinach)',
  'grounded pepper', 'groundnut oil', 'g oil', 'groundeduttoil',
  'hot dog', 'kpomo',
  'maggi', 'maggi pkt', 'maggi half', 'meat', 'goat meat', 'cow meat',
  'moimoi', 'nana',
  'nchuawu (scent leave)', 'scent leaf',
  'ofor', 'ofo', 'ogbono', 'ogiri', 'ogiri igbo', 'ogiriigbo', 'ogiri idemili',
  'oha', 'okpa', 'okpei', 'opeyi', 'okporoko',
  'okro', 'okuma', 'onions', 'onga', 'oranges', 'osu',
  'palm oil', 'red oil', 'redoil', 'palmoil',
  'pap', 'pepper soup spice', 'pepper', 'pineapple',
  'plantain', 'plantan', 'plaintain',
  'potatoes', 'potato', 'red pepper',
  'rice', 'salt', 'seasoning', 'seasonings', 'seasoning rolls',
  'spice city stew', 'spice city chicken', 'spice city seasoning', 'spices',
  'shoko', 'shombo', 'shomb o', 'sweet corn', 'tatashi', 'tatashe',
  'thyme', 'tin tomatoes', 'tin tomato', 'tintomatoes', 'sachet tomatoes', 'sachet tomato',
  'titus/ scumbia fish', 'tomato paste', 'tomatoe paste', 'tomatoes paste', 'tomatoes',
  'uda pepper', 'ugu', 'ukazi', 'ukpaka', 'upaka',
  'uziza', 'uziza seed', 'uziza leaf', 'eruru',
  'vegetables', 'vegetable', 'waterleaf', 'water leaf', 'water leave',
  'wheat', 'yam', 'yellow pepper', 'vellow pepper',
  'onugbo', 'bangs spice', 'curry roll', 'curry pkt',
  'stockfish', 'stock fish', 'stockeish',
  'tomato', 'fresh tomato',
  'grinding',
]);

// Provision items (from ITEM_CATALOG["Provision"])
const PROVISION_ITEMS = new Set([
  'biscuit', 'biscuits', 'butter', 'coffee', 'coffe', 'honey',
  'mayonnaise', 'milk', 'milo', 'millo', 'million', 'ovaltine',
  'quaker oats', 'sugar', 'sucket',
]);

// Others items (from ITEM_CATALOG["Others"])
const OTHERS_ITEMS = new Set([
  '3 watt bulb', 'adult diaper', 'air freshener', 'airfresher', 'airfreshner',
  'liquid air freshener',
  'bama', 'bathing soap', 'bar soap', 'barsoap',
  "battery for dad's radio", 'bleach', 'body lotion',
  'bowls for storing soup and stew in freezer',
  'broom', 'comb', 'comfor', 'curtain hanger',
  'dustbin nylon', 'dye', 'hair dye',
  'electrical works and fittings', 'electricity', 'light', 'nepa',
  'entrance key hole change',
  'gas', 'gotv', 'hypo', 'insecticide', 'insecticides',
  'kerosene', 'kettle', 'knife',
  'lawma', 'leaver', 'liquid soap',
  'markintosh', 'mop', 'mortar & pestle',
  'nanny lab test', 'nanny transport',
  'omo', 'painter buckets for urinating',
  'plate basket', 'police case',
  'prepaid meter recharge', 'pure water',
  'relaxer', 'relaxer for mom',
  'repair', 'nepa repair', 'nepa repire', 'tap repair', 'tank repair', 'septic tank repair',
  'rope for spreading clothes',
  'sealing bottom of entrance door + labour',
  'security fee', 'security for street',
  'sleeping mat', 'small dustbin',
  'sweeper', 'tanker water',
  'toilet brush', 'toilet cleaner',
  'toothbrushes', 'toothpaste', 'tooth paste',
  'transport', 'water',
  'rat killer', 'bed bug killer',
  'long broom stick', 'opa', 'okopa',
  'plumber',
  'soap',
  'ori', 'aboniki',  // personal care in Others context
  'izeal',
  'dye for dad',
  'mop',
  'okpa', // when in Others context from week3 data
]);

// Transport-related items (categorized as "Others")
const TRANSPORT_KEYWORDS = [
  'tfare', 't-fare', 't- fare', 'transport', 'market expense',
  'market tfare', 'hospital tfare',
];

// Drug/hospital items that indicate Mom's or Dad's drugs section
const DRUG_KEYWORDS = [
  'gabapentin', 'amulodipen', 'amlodipine', 'amoldipine', 'amoldupine',
  'amodipine', 'amulatpen', 'amulodipe', 'almodipine', 'amoldipine',
  'dolometa', 'dorometa',
  'emcap', 'bustan', 'brustan',
  'malaria medicine',
  'maxi tear', 'maxi tears',
  'eye antioxidant', 'eye clear',
  'nurovite', 'neurovite', 'neurovit', 'nurovit',
  'normoretic', 'noretric', 'noretic',
  'hemafolin', 'blood tonic',
  'escitalopram', 'estalopram',
  'vasoprin',
  'micropost', 'brimsopost', 'brimonidine', 'brimosopt',
  'arthrotech', 'arthritic', 'athrotec', 'arthrotec',
  'amitriplin', 'amitripline', 'amitriptyline', 'amitripitiline', 'amitriplyne',
  'paracetamol',
  'vitamin c', 'vitamin e',
  'fish oil', 'cod liver oil', 'cold liver oil',
  'multivitamin', 'multivitamins',
  'yeast',
  'nerve renew',
  'eppilion', 'eppillion', 'epilim',
  'sodium valproate', 'soldium valproate',
  'oxynide', 'tetracycline',
  'biophge', 'biophage',
  'atorvastatin', 'atrovastatine', 'atrovastatin', 'artovastatin',
  'epo eja', 'epo-eja', 'epoeja', 'epo eja',
  'telmipantan', 'telmisartan',
  'volini', 'cabama gel', 'carbon gel',
  'amaten', 'marcgesic',
  'pregabalin', 'zentel', 'ferrous',
  'nootropil', 'oaklife', 'brain formula',
  'cefpodoxime', 'ocefix', 'amartem',
  'lady sept',
  'nurobion',
  'asphegin', 'asphege',
  'normoretic pkt',
  'b.p battery', 'bp battery',
];

// Hospital/medical expense keywords
const HOSPITAL_KEYWORDS = [
  'hospital', 'to see doc', 'doctor', 'doctors fee',
  'eye test', 'eye appointment',
  'sugar test', 'thyroid', 'x-ray', 'radiology',
  'lens', 'frame',
  'hospital fee', 'card renewal',
  'seizure', 'post stroke', 'm.i.r',
  'fbc', 'urinalysis', 'blood test', 'lab',
  'eeg test', 'urine test',
  'consultation fee', 'file',
  'pharmacy service charge',
  'renting of wheelchair', 'nosemasks',
  'barbing hair',
  'tft', 'thyroid uss',
  'medical test',
  'endocrinology',
  'cuf eye test',
];

/**
 * Detect if a line is a section header for Mom/Dad drugs.
 * Returns 'mom', 'dad', or null.
 */
function detectDrugSectionHeader(itemName) {
  const lower = itemName.toLowerCase().trim();

  // Patterns that indicate Mom's drug section
  const momPatterns = [
    /^mom['s]*\s*(drug|medicine|:-|:|\s*$)/i,
    /^mum['s]*\s*(drug|medicine|:-|:|\s*$)/i,
    /mom['s]*\s*drugs?\s*:-?/i,
    /mum\s*drugs?/i,
    /^mom$/i, /^mom:$/i, /^mom:-$/i,
  ];

  // Patterns that indicate Dad's drug section
  const dadPatterns = [
    /^dad['s]*\s*(drug|medicine|:-|:|\s*$)/i,
    /dad['s]*\s*drugs?\s*:-?/i,
    /^dad$/i, /^dad:$/i, /^dad:-$/i,
  ];

  // Combined patterns
  const combinedPatterns = [
    /mom and dad/i,
    /drugs?\s*:-?\s*$/i,
    /^drugs:-$/i,
  ];

  for (const p of momPatterns) {
    if (p.test(lower)) return 'mom';
  }
  for (const p of dadPatterns) {
    if (p.test(lower)) return 'dad';
  }
  for (const p of combinedPatterns) {
    if (p.test(lower)) return 'both';
  }

  return null;
}

/**
 * Classify an item into one of the 5 categories.
 * Uses the current drug section context (mom/dad) for drug items.
 */
function classifyItem(itemName, drugContext) {
  const lower = itemName.toLowerCase().trim();

  // If we're in a drug context, check if this is a drug/hospital item
  if (drugContext) {
    // Check if it's a drug item
    const isDrug = DRUG_KEYWORDS.some(kw => lower.includes(kw));
    const isHospital = HOSPITAL_KEYWORDS.some(kw => lower.includes(kw));
    const isTransport = TRANSPORT_KEYWORDS.some(kw => lower.includes(kw));

    if (isDrug || isHospital || isTransport) {
      if (drugContext === 'dad') return "Dad's Drugs & Hosp. Exp";
      return "Mom's Drugs & Hosp. Exp";
    }
  }

  // Check if it's explicitly a drug/hospital item (even without context)
  const isDrug = DRUG_KEYWORDS.some(kw => lower.includes(kw));
  const isHospital = HOSPITAL_KEYWORDS.some(kw => lower.includes(kw));
  if (isDrug || isHospital) {
    if (drugContext === 'dad') return "Dad's Drugs & Hosp. Exp";
    if (drugContext === 'mom') return "Mom's Drugs & Hosp. Exp";
    // Default to Mom's if no context
    return "Mom's Drugs & Hosp. Exp";
  }

  // Check Provision (exact match or contains)
  if (PROVISION_ITEMS.has(lower)) return 'Provision';
  for (const item of PROVISION_ITEMS) {
    if (lower.includes(item) || item.includes(lower)) return 'Provision';
  }

  // Check Food (exact match or contains)
  if (FOOD_ITEMS.has(lower)) return 'Food';
  for (const item of FOOD_ITEMS) {
    if (lower === item) return 'Food';
  }
  // Partial match for food
  for (const item of FOOD_ITEMS) {
    if (lower.includes(item) && item.length > 3) return 'Food';
  }

  // Check Others (exact match or contains)
  if (OTHERS_ITEMS.has(lower)) return 'Others';
  for (const item of OTHERS_ITEMS) {
    if (lower.includes(item) && item.length > 3) return 'Others';
  }

  // Transport items -> Others
  if (TRANSPORT_KEYWORDS.some(kw => lower.includes(kw))) return 'Others';

  // Specific item checks that might not match above
  if (lower.includes('evelin') || lower.includes('burial')) return 'Others';
  if (lower.includes('refund')) return 'Others';

  // Default to Food for grocery-like items, Others for everything else
  return 'Others';
}


// ---------------------------------------------------------------------------
// Parse the all-data.txt format
// ---------------------------------------------------------------------------

/**
 * Parse a date string from the data file into a normalized Sunday weekOf date.
 * Handles formats like:
 *   "Sunday 26 May 2024"
 *   "Sunday 3rd November 2024"
 *   "6 July 2025"
 *   "1st February 2026"
 */
function parseWeekDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  let cleaned = dateStr.trim();

  // Remove "Sunday " prefix if present
  cleaned = cleaned.replace(/^Sunday\s+/i, '');

  // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
  cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

  // Parse the date
  const parts = cleaned.split(/\s+/);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);

  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  const month = months[monthStr];
  if (month === undefined || isNaN(day) || isNaN(year)) return null;

  const date = new Date(year, month, day);

  // Find the Sunday of this week (weekOf)
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - dayOfWeek);

  // Format as YYYY-MM-DD
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse price string like "8,000.00" or "8000" into a number.
 */
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === '') return 0;
  return Number(priceStr.replace(/,/g, ''));
}

/**
 * Check if a line is just a section label (no meaningful price data).
 */
function isSectionLabel(itemName) {
  const lower = itemName.toLowerCase().trim();
  return (
    detectDrugSectionHeader(itemName) !== null ||
    lower === 'running total' ||
    lower.includes('happy new year')
  );
}

/**
 * Parse the TSV data from all-data.txt.
 * Format: "Week Of Expenditure\tItem\tItem Bought?\tPrice"
 */
function parseAllData(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentWeekOf = null;
  let drugContext = null; // 'mom' | 'dad' | 'both' | null

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const dateStr = (parts[0] || '').trim();
    const itemName = (parts[1] || '').trim();
    const purchased = (parts[2] || '').trim();
    const priceStr = (parts[3] || '').trim();

    // Skip empty items or pure label rows
    if (!itemName) continue;

    // Skip "Running Total" and "Happy new year" lines
    if (itemName.toLowerCase().includes('running total') ||
        itemName.toLowerCase().includes('happy new year')) {
      continue;
    }

    // Update weekOf if we have a new date
    if (dateStr && dateStr !== '') {
      const parsedWeek = parseWeekDate(dateStr);
      if (parsedWeek) {
        // New week resets drug context
        if (parsedWeek !== currentWeekOf) {
          drugContext = null;
        }
        currentWeekOf = parsedWeek;
      }
    }

    if (!currentWeekOf) continue;

    // Check if this line is a drug section header
    const sectionHeader = detectDrugSectionHeader(itemName);
    if (sectionHeader) {
      drugContext = sectionHeader === 'both' ? 'mom' : sectionHeader;
      // If it has a price, it's also an entry (rare but possible)
      const price = parsePrice(priceStr);
      if (price === 0) continue;
      // Fall through to create entry
    }

    // Parse price
    const price = parsePrice(priceStr);
    if (price === 0) continue;

    // Determine if this item breaks us out of drug context
    // (i.e., it's clearly a food/household item after a drug section)
    const lower = itemName.toLowerCase().trim();
    const isDrugItem = DRUG_KEYWORDS.some(kw => lower.includes(kw)) ||
                       HOSPITAL_KEYWORDS.some(kw => lower.includes(kw)) ||
                       TRANSPORT_KEYWORDS.some(kw => lower.includes(kw));

    if (drugContext && !isDrugItem && !sectionHeader) {
      // Check if this is clearly a non-drug item
      const isFood = FOOD_ITEMS.has(lower) || [...FOOD_ITEMS].some(f => lower.includes(f) && f.length > 3);
      const isProvision = PROVISION_ITEMS.has(lower) || [...PROVISION_ITEMS].some(p => lower.includes(p));
      const isOthers = OTHERS_ITEMS.has(lower) || [...OTHERS_ITEMS].some(o => lower.includes(o) && o.length > 3);

      if (isFood || isProvision || isOthers) {
        drugContext = null; // Reset context
      }
    }

    // Classify category
    const category = classifyItem(itemName, drugContext);

    // Determine purchased status
    let isPurchased = true; // Historical data defaults to purchased
    const purchasedLower = purchased.toLowerCase();
    if (purchasedLower === 'n' || purchasedLower === 'no') {
      isPurchased = false;
    }

    entries.push({
      weekOf: currentWeekOf,
      entryId: randomUUID(),
      category,
      item: itemName.trim(),
      price,
      status: 'approved',
      purchased: isPurchased,
      createdBy: 'import',
      createdByName: 'Historical Import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// DynamoDB operations
// ---------------------------------------------------------------------------

async function deleteOldRecords() {
  console.log('Scanning table for records with weekOf <= 2026-02-01...');
  let totalDeleted = 0;
  let lastEvaluatedKey;

  do {
    const scanParams = {
      TableName: TABLE_NAME,
      ProjectionExpression: 'weekOf, entryId',
      FilterExpression: 'weekOf <= :cutoff',
      ExpressionAttributeValues: { ':cutoff': '2026-02-01' },
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

  console.log(`Deleted ${totalDeleted} old records (weekOf <= 2026-02-01).`);
  return totalDeleted;
}

async function writeEntries(entries) {
  let written = 0;
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
    written += batch.length;

    if (written % 100 === 0) {
      process.stdout.write(`  Written ${written}/${entries.length} entries...\r`);
    }
  }
  console.log(`  Written ${written}/${entries.length} entries.          `);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Expense Tracker: Re-import Historical Data ===\n');
  console.log(`Target table: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}\n`);

  // Step 1: Delete old records
  console.log('Step 1: Deleting old records (weekOf <= 2026-02-01)...');
  await deleteOldRecords();
  console.log('');

  // Step 2: Read and parse all-data.txt
  console.log('Step 2: Parsing all-data.txt...');
  const dataPath = resolve(__dirname, '../data/all-data.txt');

  let content;
  try {
    content = readFileSync(dataPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read ${dataPath}: ${err.message}`);
    console.log('\nPlease ensure all-data.txt is in the data/ directory.');
    process.exit(1);
  }

  const entries = parseAllData(content);
  console.log(`  Parsed ${entries.length} entries.`);

  // Group by weekOf for summary
  const weekGroups = {};
  for (const entry of entries) {
    if (!weekGroups[entry.weekOf]) weekGroups[entry.weekOf] = [];
    weekGroups[entry.weekOf].push(entry);
  }

  const weekKeys = Object.keys(weekGroups).sort();
  console.log(`  Spanning ${weekKeys.length} weeks: ${weekKeys[0]} to ${weekKeys[weekKeys.length - 1]}`);

  const totalAmount = entries.reduce((sum, e) => sum + e.price, 0);
  console.log(`  Total amount: N${totalAmount.toLocaleString()}`);

  // Category breakdown
  const catBreakdown = {};
  for (const entry of entries) {
    if (!catBreakdown[entry.category]) catBreakdown[entry.category] = { count: 0, total: 0 };
    catBreakdown[entry.category].count++;
    catBreakdown[entry.category].total += entry.price;
  }
  console.log('\n  Category breakdown:');
  for (const [cat, data] of Object.entries(catBreakdown).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`    ${cat}: ${data.count} items, N${data.total.toLocaleString()}`);
  }
  console.log('');

  // Print per-week summary
  console.log('  Per-week breakdown:');
  for (const wk of weekKeys) {
    const items = weekGroups[wk];
    const weekTotal = items.reduce((sum, e) => sum + e.price, 0);
    console.log(`    ${wk}: ${items.length} items, N${weekTotal.toLocaleString()}`);
  }
  console.log('');

  // Step 3: Write to DynamoDB
  console.log('Step 3: Writing entries to DynamoDB...');
  await writeEntries(entries);
  console.log('');

  console.log(`Done! Successfully imported ${entries.length} entries across ${weekKeys.length} weeks.`);
  console.log(`   Total: N${totalAmount.toLocaleString()}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
