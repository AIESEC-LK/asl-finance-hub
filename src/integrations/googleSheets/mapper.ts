/**
 * Data Mapper: Sheet Columns → Database Schema
 * 
 * This mapper transforms raw Google Sheet data into the database schema.
 * Configuration allows flexible column mapping.
 */

import type { MonthlyMetric, FunctionCode } from "@/lib/finance";

export interface MapperConfig {
  entityNameColumn: string;
  monthColumn: string;
  termColumn?: string;
  bankBalanceColumn?: string;
  inflowColumn?: string;
  outflowColumn?: string;
  assetsColumn?: string;
  liabilitiesColumn?: string;
  receivablesColumn?: string;
  liquidityColumn?: string;
  equityColumn?: string;
  totalRevenueColumn?: string;
  totalCostColumn?: string;
  npmColumn?: string;
  gpmColumn?: string;
  healthIndexColumn?: string;
  odScoreColumn?: string;
  globalRankingColumn?: string;
  apRankingColumn?: string;
  // Revenue streams by function
  revenueColumns?: Record<FunctionCode, string>;
  // Cost breakdown by function
  costColumns?: Record<FunctionCode, string>;
  // Budget vs actual
  budgetColumns?: Record<string, { budget: string; actual: string }>;
  // Audit scores
  auditQuarterColumn?: string;
  auditScoreColumn?: string;
  auditMaxScoreColumn?: string;
  auditRemarksColumn?: string;
  // Review status
  reviewStatusColumn?: string;
  reviewRemarksColumn?: string;
}

/**
 * Default mapper configuration for AIESEC Finance Sheet
 * Adjust based on actual sheet structure
 */
export const DEFAULT_CONFIG: MapperConfig = {
  entityNameColumn: "Entity",
  monthColumn: "Month",
  termColumn: "Term",
  bankBalanceColumn: "Bank Balance",
  inflowColumn: "Inflow",
  outflowColumn: "Outflow",
  assetsColumn: "Assets",
  liabilitiesColumn: "Liabilities",
  receivablesColumn: "Receivables",
  liquidityColumn: "Liquidity",
  equityColumn: "Equity",
  totalRevenueColumn: "Total Revenue",
  totalCostColumn: "Total Cost",
  npmColumn: "NPM",
  gpmColumn: "GPM",
  healthIndexColumn: "Health Index",
  odScoreColumn: "OD Score",
  globalRankingColumn: "Global Ranking",
  apRankingColumn: "AP Ranking",
  revenueColumns: {
    iGV: "Revenue iGV",
    iGT: "Revenue iGT",
    oGV: "Revenue oGV",
    oGT: "Revenue oGT",
    ELD: "Revenue ELD",
    EwA: "Revenue EwA",
    BD: "Revenue BD",
  },
  costColumns: {
    iGV: "Cost iGV",
    iGT: "Cost iGT",
    oGV: "Cost oGV",
    oGT: "Cost oGT",
    ELD: "Cost ELD",
    EwA: "Cost EwA",
    BD: "Cost BD",
  },
};

/**
 * Find column index by name (case-insensitive)
 */
function findColumnIndex(headers: string[], columnName: string | undefined): number {
  if (!columnName) return -1;
  return headers.findIndex((h) => h.toLowerCase().trim() === columnName.toLowerCase().trim());
}

/**
 * Safe parse number
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? null : num;
}

/**
 * Parse month string to YYYY-MM-DD (first day of month)
 */
function parseMonth(monthStr: string): string | null {
  if (!monthStr) return null;

  // Try various formats: "May 2025", "May-2025", "2025-05", etc.
  const patterns = [
    /(\w+)\s+(\d{4})/, // "May 2025"
    /(\w+)-(\d{4})/, // "May-2025"
    /(\d{4})-(\d{1,2})/, // "2025-05"
  ];

  const months: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  for (const pattern of patterns) {
    const match = monthStr.trim().toLowerCase().match(pattern);
    if (match) {
      if (pattern === patterns[0] || pattern === patterns[1]) {
        const monthName = match[1];
        const year = parseInt(match[2]);
        const month = months[monthName];
        if (month) {
          return `${year}-${String(month).padStart(2, "0")}-01`;
        }
      } else {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        if (month >= 1 && month <= 12) {
          return `${year}-${String(month).padStart(2, "0")}-01`;
        }
      }
    }
  }

  return null;
}

/**
 * Transform sheet row to MonthlyMetric
 */
export function mapSheetRowToMetric(
  row: any[],
  headers: string[],
  entityIdMap: Map<string, string>,
  config: MapperConfig
): MonthlyMetric | null {
  const entityName = row[findColumnIndex(headers, config.entityNameColumn)]?.toString().trim();
  const monthStr = row[findColumnIndex(headers, config.monthColumn)]?.toString().trim();

  if (!entityName || !monthStr) return null;

  const entityId = entityIdMap.get(entityName);
  if (!entityId) {
    console.warn(`Entity not found in database: ${entityName}`);
    return null;
  }

  const periodMonth = parseMonth(monthStr);
  if (!periodMonth) {
    console.warn(`Could not parse month: ${monthStr}`);
    return null;
  }

  return {
    id: "", // Will be generated by DB
    entity_id: entityId,
    period_month: periodMonth,
    term: config.termColumn
      ? row[findColumnIndex(headers, config.termColumn)]?.toString().trim() || null
      : null,
    bank_balance: parseNumber(
      row[findColumnIndex(headers, config.bankBalanceColumn)]
    ),
    inflow: parseNumber(row[findColumnIndex(headers, config.inflowColumn)]),
    outflow: parseNumber(row[findColumnIndex(headers, config.outflowColumn)]),
    assets: parseNumber(row[findColumnIndex(headers, config.assetsColumn)]),
    liabilities: parseNumber(
      row[findColumnIndex(headers, config.liabilitiesColumn)]
    ),
    receivables: parseNumber(
      row[findColumnIndex(headers, config.receivablesColumn)]
    ),
    liquidity: parseNumber(row[findColumnIndex(headers, config.liquidityColumn)]),
    equity: parseNumber(row[findColumnIndex(headers, config.equityColumn)]),
    total_revenue: parseNumber(
      row[findColumnIndex(headers, config.totalRevenueColumn)]
    ),
    total_cost: parseNumber(
      row[findColumnIndex(headers, config.totalCostColumn)]
    ),
    npm: parseNumber(row[findColumnIndex(headers, config.npmColumn)]),
    gpm: parseNumber(row[findColumnIndex(headers, config.gpmColumn)]),
    finance_health_index: parseNumber(
      row[findColumnIndex(headers, config.healthIndexColumn)]
    ),
    finance_od_score: parseNumber(
      row[findColumnIndex(headers, config.odScoreColumn)]
    ),
    global_ranking: parseNumber(
      row[findColumnIndex(headers, config.globalRankingColumn)]
    ),
    ap_ranking: parseNumber(
      row[findColumnIndex(headers, config.apRankingColumn)]
    ),
  };
}

/**
 * Transform sheet row to revenue streams (one per function)
 */
export function mapSheetRowToRevenueStreams(
  row: any[],
  headers: string[],
  entityIdMap: Map<string, string>,
  monthStr: string,
  config: MapperConfig
): Array<{
  entity_id: string;
  period_month: string;
  function_code: FunctionCode;
  amount: number;
}> | null {
  const entityName = row[findColumnIndex(headers, config.entityNameColumn)]?.toString().trim();
  if (!entityName || !config.revenueColumns) return null;

  const entityId = entityIdMap.get(entityName);
  if (!entityId) return null;

  const periodMonth = parseMonth(monthStr);
  if (!periodMonth) return null;

  const revenues: any[] = [];
  for (const [func, colName] of Object.entries(config.revenueColumns)) {
    const amount = parseNumber(row[findColumnIndex(headers, colName)]);
    if (amount !== null) {
      revenues.push({
        entity_id: entityId,
        period_month: periodMonth,
        function_code: func as FunctionCode,
        amount,
      });
    }
  }

  return revenues.length ? revenues : null;
}

/**
 * Auto-detect column structure from headers
 */
export function autoDetectColumns(headers: string[]): Partial<MapperConfig> {
  const config: Partial<MapperConfig> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Find key columns
  if (lowerHeaders.some((h) => h.includes("entity"))) {
    config.entityNameColumn = headers[lowerHeaders.findIndex((h) => h.includes("entity"))];
  }
  if (lowerHeaders.some((h) => h.includes("month"))) {
    config.monthColumn = headers[lowerHeaders.findIndex((h) => h.includes("month"))];
  }
  if (lowerHeaders.some((h) => h.includes("term"))) {
    config.termColumn = headers[lowerHeaders.findIndex((h) => h.includes("term"))];
  }

  // Financial metrics
  ["bank", "inflow", "outflow", "asset", "liab", "receivable", "liquid", "equity", "revenue", "cost", "npm", "gpm", "health", "ranking"].forEach(
    (key) => {
      const idx = lowerHeaders.findIndex((h) => h.includes(key));
      if (idx !== -1) {
        const colName = headers[idx];
        if (key === "bank") config.bankBalanceColumn = colName;
        else if (key === "inflow") config.inflowColumn = colName;
        else if (key === "outflow") config.outflowColumn = colName;
        else if (key === "asset") config.assetsColumn = colName;
        else if (key === "liab") config.liabilitiesColumn = colName;
        else if (key === "receivable") config.receivablesColumn = colName;
        else if (key === "liquid") config.liquidityColumn = colName;
        else if (key === "equity") config.equityColumn = colName;
      }
    }
  );

  return config;
}
