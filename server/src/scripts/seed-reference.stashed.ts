/**
 * Seeds the reference data every other flow depends on: suppliers and the
 * product catalogue, transcribed from the Supabase MVP database.
 *
 * Idempotent — re-running skips rows that already exist, because both tables
 * carry unique indexes (supplier name/code, and brand+variety+size).
 *
 * Usage: npm run seed
 */
import { sql } from "drizzle-orm";
import { closeDatabase, db } from "../db/client.js";
import { productCategories, stockBalances, suppliers } from "../db/schema.js";

const SUPPLIERS: Array<{ name: string; code: string | null }> = [
  { name: "GY", code: "GY" },
  { name: "LI CY", code: "LI CY" },
  // Possibly a misreading of "LI CY" in the notebooks — kept separate until confirmed.
  { name: "LI LY", code: "LI LY" },
];

/**
 * [brand, variety, size_kg, notebook code, is_available, selling_price?]
 * selling_price defaults to 0 when left off.
 */
type ProductSeed = [string, string | null, number, string | null, boolean, number?];

/**
 * For products the wall price list doesn't price (blank on the board, or not
 * on it at all). Prices below were read from the board photo; 5kg and 10kg
 * prices there look like they're per bundle rather than per sack — see
 * PosTodos.md before relying on them.
 */
const DEFAULT_SELLING_PRICE = 0;

const PRODUCTS: ProductSeed[] = [
  ["Bea", null, 5, null, false],
  ["Bea", null, 10, null, false],
  ["Bea", null, 25, null, false],
  ["Bea", null, 50, null, false],
  ["Binhi", null, 25, null, true],
  ["Binhi", null, 50, null, false],
  ["Carlos Uno", null, 25, null, false],
  ["Crack Corn", null, 25, null, true],
  ["Dona Conchita", "Blue", 5, null, true, 2500],
  ["Dona Conchita", "Blue", 25, null, true],
  ["Dona Conchita", "Blue", 50, null, true],
  ["Dona Conchita", "Orange", 5, null, true, 2800],
  ["Dona Conchita", "Orange", 25, null, true, 1350],
  ["Dona Conchita", "Orange", 50, null, true],
  ["Dona Conchita", "Pink", 5, null, true, 2400],
  ["Dona Conchita", "Pink", 25, null, true, 1150],
  ["Excellent", null, 5, null, true, 2550],
  ["Excellent", null, 25, null, true, 1220],
  ["Excellent", null, 50, null, true, 2400],
  ["Ganador", null, 5, "G", true, 2720],
  ["Ganador", null, 10, "G", true, 2710],
  ["Ganador", null, 25, "G", true, 1315],
  ["Ganador", null, 50, "G", true, 2620],
  ["Grandeur", null, 5, null, false],
  ["Grandeur", null, 10, null, false],
  ["Grandeur", null, 25, null, false],
  ["Grandeur", null, 50, null, false],
  ["Ivory", "Red", 5, null, true, 2580], 
  ["Ivory", "Red", 25, null, true, 1235],
  ["Ivory", "Red", 50, null, true, 2430],
  ["Jaguar", "Blue", 25, null, false],
  ["Jaguar", "Blue", 50, null, false],
  ["L-King", "Blue", 5, "L", true, 2480],
  ["L-King", "Blue", 25, "L", true, 1185],
  ["L-King", "Blue", 50, "L", true, 2770],
  ["Lion Ivory", null, 5, "L-I", true, 2590],
  ["Lion Ivory", null, 10, "L-I", true, 2570],
  ["Lion Ivory", null, 25, "L-I", true, 1255],
  ["Lion Ivory", null, 50, "L-I", true, 2500],
  ["Oil", null, 14, null, true],
  ["Palawan", null, 5, "PAL", true, 2480],
  ["Palawan", null, 25, "PAL", true, 1185],
  ["Palawan", null, 50, "PAL", true, 2770],
  ["Palawan", "Blue 5%", 5, null, true, 2450],
  ["Palawan", "Blue 5%", 25, null, true, 1200],
  ["Palawan", "Blue 5%", 50, null, true, 2280],
  ["Palawan", "Japonica", 5, null, true, 2400],
  ["Palawan", "Japonica", 25, null, true, 1150],
  ["Palawan", "Japonica", 50, null, true, 2300],
  ["Palawan", "Jasmin Broken", 50, null, false],
  ["Palawan", "Lami-Ah (Red)", 5, "P/LAMI", true, 2600],
  ["Palawan", "Lami-Ah (Red)", 25, "P/LAMI", true, 1240],
  ["Palawan", "Lami-Ah (Red)", 50, "P/LAMI", true, 2450],
  ["Palawan", "Violet", 50, null, true],
  ["PDP", null, 50, null, true, 1250],
  ["Pilit", null, 50, null, false, 2150],
  ["Planters", "Blue", 25, null, false],
  ["Planters", "Blue", 50, null, false],
  ["Planters", "White", 25, null, false],
  ["Planters", "White", 50, null, false],
  ["Planters", "Yellow", 25, null, false],
  ["Planters", "Yellow", 50, null, false],
  ["Princess Mia", null, 5, null, false],
  ["Princess Raya", null, 5, null, false],
  ["Princess Raya", null, 25, null, false],
  ["Princess Raya", null, 50, null, false],
  ["Queen Bee", null, 25, null, false],
  ["Wowowee", null, 5, null, true, 2530],
  ["Wowowee", null, 10, null, false],
  ["Wowowee", null, 25, null, true, 1215],
  ["Wowowee", null, 50, null, true, 2420],
];

try {
  // No conflict target: both tables guard identity with expression-based
  // unique indexes, which onConflictDoNothing() covers without naming them.
  const insertedSuppliers = await db
    .insert(suppliers)
    .values(SUPPLIERS)
    .onConflictDoNothing()
    .returning({ id: suppliers.id });

  // selling_price comes from the wall price list where the board has one,
  // and is 0 otherwise. A price of 0 still counts as priced: every
  // available product shows up in the POS at ₱0.00 until a real price is set.
  // Existing products are skipped (onConflictDoNothing), so re-running this
  // never overwrites a price someone has already set.
  const insertedProducts = await db
    .insert(productCategories)
    .values(
      PRODUCTS.map(([brand, variety, sizeKg, code, isAvailable, sellingPrice]) => ({
        brand,
        variety,
        sizeKg,
        code,
        isAvailable,
        sellingPrice: sellingPrice ?? DEFAULT_SELLING_PRICE,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: productCategories.id });

  // The product_category trigger already creates these, so this only backfills
  // products that predate it.
  await db.execute(sql`
    insert into ${stockBalances} (product_category_id, remaining_qty)
    select id, 0 from ${productCategories}
    on conflict (product_category_id) do nothing
  `);

  process.stdout.write(
    `Seeded ${insertedSuppliers.length} suppliers and ${insertedProducts.length} products ` +
      `(${SUPPLIERS.length - insertedSuppliers.length} and ${PRODUCTS.length - insertedProducts.length} already present)\n`,
  );
} finally {
  await closeDatabase();
}
