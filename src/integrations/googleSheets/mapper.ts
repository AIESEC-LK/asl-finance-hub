/**
 * Data Mapper: MASTER_COMBINED_TALL → Database Schema
 * * This mapper uses an Exact Dictionary approach based on AIESEC GFB Codes.
 * Every valid 4-digit code is explicitly defined below to guarantee 100% accuracy.
 */

import type { FunctionCode } from "@/lib/finance";

// ─── LC code → entity name mapping ──────────────────────────────────────────
export const LC_CODE_TO_NAME: Record<string, string> = {
  CC: "Colombo Central",
  CN: "Colombo North",
  CS: "Colombo South",
  Kandy: "Kandy",
  Jaffna: "Jaffna",
  USJ: "USJ",
  NSBM: "NSBM",
  Ruhuna: "Ruhuna",
  Rajarata: "Rajarata",
  SLIIT: "SLIIT",
  NIBM: "NIBM",
  Wayamba: "Wayamba",
};

// ─── Types ──────────────────────────────────────────────────────────────────
export type RowCategory = "revenue" | "cost" | "balance_sheet" | "cash_flow" | "unknown";
export type BalanceField = "bank_balance" | "assets" | "receivables" | "equity" | "liabilities" | "cash_inflow" | "cash_outflow" | null;

interface MappingDefinition {
  category: RowCategory;
  functionCode: FunctionCode | null;
  balanceField: BalanceField;
}

// ─── The Exact GFB Dictionary ───────────────────────────────────────────────
const GFB_DICTIONARY: Record<string, MappingDefinition> = {
  // === CASH FLOW: INFLOWS ===
  "1301-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1302-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1303-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1304-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1305-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1306-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1307-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1308-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1309-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1310-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1311-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1312-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1313-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1314-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1315-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1316-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1317-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1318-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1319-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1320-FA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },
  "1321-FA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" },

  // === CASH FLOW: OUTFLOWS ===
  "1401-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1402-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1403-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1404-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1405-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1406-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1409-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1410-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1411-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1412-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1413-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1414-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1415-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1416-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1417-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1418-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1419-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1420-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1421-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1422-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1423-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1424-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1425-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1426-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1427-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1428-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1429-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1430-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1431-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1432-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1433-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1434-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1435-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1436-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1437-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1438-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1439-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1440-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1441-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1442-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1443-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1444-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1445-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1446-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1447-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1448-FA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },
  "1449-FA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" },

  // === BALANCE SHEET: OPENING BALANCE ===
  "1501-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "bank_balance" },

  // === PNL: REVENUE ===
  "7001-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null },
  "7002-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null },
  "7003-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null },
  "7004-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null },
  "7005-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null },
  "7006-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null },
  "7007-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null },
  "7008-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null },
  "7009-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7010-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7011-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7012-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7013-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7014-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7015-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7016-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7017-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7018-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7019-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null },
  "7020-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7021-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7022-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null },
  "7101-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7102-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7103-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7104-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7105-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7106-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7107-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7108-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7109-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7110-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7111-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null },
  "7301-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7302-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7303-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7304-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7305-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7306-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7307-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7308-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7309-MG-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },
  "7501-NE-RV-LC": { category: "revenue", functionCode: "BD", balanceField: null },

  // === PNL: COSTS ===
  "7601-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null },
  "7602-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null },
  "7603-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null },
  "7604-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null },
  "7605-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null },
  "7606-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null },
  "7607-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null },
  "7608-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7609-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7610-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7611-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7612-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7613-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7614-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7615-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7616-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null },
  "7617-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7618-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7619-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null },
  "7701-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7702-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7703-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7704-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7705-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7706-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null },
  "7901-MG-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "7902-MG-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "7903-MG-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "7904-MG-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "7905-MG-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8001-FN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8002-FN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8101-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8102-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8103-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8104-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8105-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8106-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8108-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8109-OH-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8201-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8202-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8203-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8204-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8205-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8206-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8207-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8208-IN-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8401-NE-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },
  "8402-NE-CO-LC": { category: "cost", functionCode: "BD", balanceField: null },

  // === BALANCE SHEET: ASSETS, LIABILITIES, EQUITY ===
  "8501-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "bank_balance" },
  "8502-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "bank_balance" },
  "8601-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" },
  "8602-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" },
  "8603-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" },
  "8604-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" },
  "8605-IN-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8606-LR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8607-LR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8609-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" }, // Prepaid Expenses
  "8611-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8612-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8613-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8614-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8615-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8616-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8617-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" },
  "8618-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // Allowance for Uncollectible
  "8701-EQ-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "equity" },
  "8801-IN-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8802-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8803-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8805-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8806-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // Prepaid Incomes
  "8807-IN-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8808-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8809-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8811-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8812-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
  "8813-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" },
};

export function getGfbMapping(gfbCode: string): MappingDefinition {
  // Use the exact full code (trimmed and uppercase to be safe)
  const cleanCode = gfbCode.trim().toUpperCase();
  
  // Return the mapped definition, or fallback if they invent a new code
  return GFB_DICTIONARY[cleanCode] || { category: "unknown", functionCode: null, balanceField: null };
}

// ─── Parsed row type ────────────────────────────────────────────────────────
export interface ParsedRow {
  lcCode: string;
  entityName: string;
  term: string;
  periodMonth: string; // YYYY-MM-DD
  reportType: string;
  gfbCode: string;
  description: string;
  amount: number;
  category: RowCategory;
  functionCode: FunctionCode | null;
  balanceField: BalanceField;
}

/**
 * Parse a single raw sheet row into a structured ParsedRow.
 */
export function parseRow(row: any[]): ParsedRow | null {
  if (!row || row.length < 9) return null;

  const lcCode = String(row[0] || "").trim();
  const term = String(row[1] || "").trim();
  const date = String(row[4] || "").trim();
  const reportType = String(row[5] || "").trim();
  const gfbCode = String(row[6] || "").trim();
  const description = String(row[7] || "").trim();
  
  const amountStr = String(row[8] || "0").replace(/[^0-9.\-]/g, "");
  const amount = parseFloat(amountStr) || 0;

  if (!lcCode || !date || !gfbCode) return null;

  const entityName = LC_CODE_TO_NAME[lcCode];
  if (!entityName) return null;

  // Normalize date to first-of-month
  const periodMonth = date.length >= 10 ? date.substring(0, 10) : null;
  if (!periodMonth) return null;

  // Perform lookup using our hardcoded dictionary
  const mapping = getGfbMapping(gfbCode);

  return {
    lcCode,
    entityName,
    term,
    periodMonth,
    reportType,
    gfbCode,
    description,
    amount,
    category: mapping.category,
    functionCode: mapping.functionCode,
    balanceField: mapping.balanceField,
  };
}


// /**
//  * Data Mapper: MASTER_COMBINED_TALL → Database Schema
//  *
//  * The Google Sheet uses a tall/tidy format with GFB (Global Finance Book) codes.
//  * Each row = one financial line item for one LC in one month.
//  *
//  * Columns: LC, LC_Term, Year, Month, Date, Report_Type, GFB_Code, Description, Amount
//  *
//  * This mapper:
//  *  1. Maps LC codes → entity IDs (CC→Colombo Central, etc.)
//  *  2. Classifies rows as Revenue, Cost, or Balance Sheet based on description
//  *  3. Maps items to function codes (iGV, iGT, oGV, oGT, ELD, EwA, BD)
//  *  4. Aggregates per (entity, month) for monthly_metrics
//  */

// import type { FunctionCode } from "@/lib/finance";

// // ─── LC code → entity name mapping ──────────────────────────────────────────
// export const LC_CODE_TO_NAME: Record<string, string> = {
//   CC: "Colombo Central",
//   CN: "Colombo North",
//   CS: "Colombo South",
//   Kandy: "Kandy",
//   Jaffna: "Jaffna",
//   USJ: "USJ",
//   NSBM: "NSBM",
//   Ruhuna: "Ruhuna",
//   Rajarata: "Rajarata",
//   SLIIT: "SLIIT",
//   NIBM: "NIBM",
//   Wayamba: "Wayamba",
// };

// // ─── Row classification ─────────────────────────────────────────────────────

// export type RowCategory = "revenue" | "cost" | "balance_sheet" | "unknown";

// /**
//  * Classify a row based on GFB code prefix and description.
//  * GFB 7xxx = Revenue/Cost (PnL). GFB 1xxx = Balance sheet (CFS).
//  */
// export function classifyRow(
//   gfbCode: string,
//   description: string,
//   reportType: string
// ): RowCategory {
//   const desc = description.toLowerCase();
//   const code = gfbCode.trim();

//   // PnL items
//   if (reportType === "PnL" || code.startsWith("7") || code.startsWith("8")) {
//     if (
//       desc.includes("revenue") ||
//       desc.includes("partner fee") ||
//       desc.includes("program fee") ||
//       desc.includes("grants") ||
//       desc.includes("donations") ||
//       desc.includes("participant fee") ||
//       desc.includes("miscellaneous revenue")
//     ) {
//       return "revenue";
//     }
//     // Everything else in PnL is cost
//     return "cost";
//   }

//   // CFS / Balance sheet items
//   if (reportType === "CFS" || code.startsWith("1")) {
//     return "balance_sheet";
//   }

//   return "unknown";
// }

// // ─── Function code mapping ──────────────────────────────────────────────────

// /**
//  * Map a description to a function code for revenue/cost streams.
//  */
// export function descriptionToFunctionCode(description: string): FunctionCode {
//   const desc = description.toLowerCase();

//   if (desc.includes("igv")) return "iGV";
//   if (desc.includes("igta") || desc.includes("igte")) return "iGT";
//   if (desc.includes("ogv")) return "oGV";
//   if (desc.includes("ogta") || desc.includes("ogte")) return "oGT";
//   if (desc.includes("eld") || desc.includes("leadership")) return "ELD";
//   if (desc.includes("ewa")) return "EwA";

//   // Everything else → BD (Business Development / general management)
//   return "BD";
// }

// // ─── Balance-sheet field mapping ────────────────────────────────────────────

// export type BalanceField =
//   | "bank_balance"
//   | "assets"
//   | "receivables"
//   | "equity"
//   | "liabilities"
//   | null;

// /**
//  * Map a CFS description to a monthly_metrics balance-sheet field.
//  */
// export function descriptionToBalanceField(description: string): BalanceField {
//   const desc = description.toLowerCase();

//   if (desc.includes("bank account") || desc.includes("petty cash")) return "bank_balance";
//   if (desc.includes("receivable")) return "receivables";
//   if (desc.includes("equity")) return "equity";
//   if (
//     desc.includes("long term assets") ||
//     desc.includes("prepaid")
//   ) {
//     return "assets";
//   }

//   return null;
// }

// // ─── Parsed row type ────────────────────────────────────────────────────────

// export interface ParsedRow {
//   lcCode: string;
//   entityName: string;
//   term: string;
//   periodMonth: string; // YYYY-MM-DD
//   reportType: string;
//   gfbCode: string;
//   description: string;
//   amount: number;
//   category: RowCategory;
//   functionCode: FunctionCode | null;
//   balanceField: BalanceField;
// }

// /**
//  * Parse a single raw sheet row into a structured ParsedRow.
//  * Returns null if the row is invalid or empty.
//  */
// export function parseRow(row: any[]): ParsedRow | null {
//   if (!row || row.length < 9) return null;

//   const lcCode = String(row[0] || "").trim();
//   const term = String(row[1] || "").trim();
//   const date = String(row[4] || "").trim(); // YYYY-MM-DD format
//   const reportType = String(row[5] || "").trim();
//   const gfbCode = String(row[6] || "").trim();
//   const description = String(row[7] || "").trim();
//   const amountStr = String(row[8] || "0").replace(/[^0-9.\-]/g, "");
//   const amount = parseFloat(amountStr) || 0;

//   if (!lcCode || !date) return null;

//   const entityName = LC_CODE_TO_NAME[lcCode];
//   if (!entityName) return null;

//   // Normalize date to first-of-month
//   const periodMonth = date.length >= 10 ? date.substring(0, 10) : null;
//   if (!periodMonth) return null;

//   const category = classifyRow(gfbCode, description, reportType);
//   const functionCode =
//     category === "revenue" || category === "cost"
//       ? descriptionToFunctionCode(description)
//       : null;
//   const balanceField =
//     category === "balance_sheet"
//       ? descriptionToBalanceField(description)
//       : null;

//   return {
//     lcCode,
//     entityName,
//     term,
//     periodMonth,
//     reportType,
//     gfbCode,
//     description,
//     amount,
//     category,
//     functionCode,
//     balanceField,
//   };
// }
