/**
 * Google Sheets Sync Service
 * 
 * Orchestrates fetching, parsing, and syncing data from Google Sheets to Supabase
 */

import { fetchSheetData } from "./client";
import {
  mapSheetRowToMetric,
  mapSheetRowToRevenueStreams,
  autoDetectColumns,
  DEFAULT_CONFIG,
  type MapperConfig,
} from "./mapper";
import { supabase } from "@/integrations/supabase/client";
import type { Entity } from "@/lib/finance";

const SHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";
const SHEET_RANGE = "Sheet1!A1:Z1000"; // Adjust range as needed

export interface SyncResult {
  success: boolean;
  message: string;
  metricsInserted: number;
  revenueInserted: number;
  costInserted: number;
  errors: string[];
}

/**
 * Build map of entity names to IDs
 */
async function buildEntityMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from("entities").select("id,name");
  const map = new Map<string, string>();
  data?.forEach((entity: Entity) => {
    map.set(entity.name, entity.id);
  });
  return map;
}

/**
 * Main sync function: Fetch sheet → Parse → Insert to DB
 */
export async function syncSheetData(
  customConfig?: MapperConfig
): Promise<SyncResult> {
  const errors: string[] = [];
  let metricsInserted = 0;
  let revenueInserted = 0;
  let costInserted = 0;

  try {
    console.log("📊 Syncing Google Sheets data...");

    // 1. Fetch sheet data
    console.log(`⏳ Fetching from sheet: ${SHEET_ID}`);
    const rows = await fetchSheetData(SHEET_ID, SHEET_RANGE);

    if (!rows || rows.length < 2) {
      return {
        success: false,
        message: "Sheet appears to be empty",
        metricsInserted,
        revenueInserted,
        costInserted,
        errors: ["No data rows found in sheet"],
      };
    }

    // 2. Extract headers and auto-detect columns
    const headers = rows[0] as string[];
    console.log(`✅ Found headers: ${headers.join(", ")}`);

    const detectedConfig = autoDetectColumns(headers);
    const config = { ...DEFAULT_CONFIG, ...detectedConfig, ...customConfig };

    console.log(`⏳ Auto-detected config:`, {
      entityColumn: config.entityNameColumn,
      monthColumn: config.monthColumn,
      termColumn: config.termColumn,
    });

    // 3. Build entity map
    const entityMap = await buildEntityMap();
    console.log(`✅ Loaded ${entityMap.size} entities from database`);

    // 4. Parse and insert monthly_metrics
    console.log("⏳ Processing monthly metrics...");
    const metricsToInsert: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const metric = mapSheetRowToMetric(row, headers, entityMap, config);

      if (metric) {
        metricsToInsert.push({
          entity_id: metric.entity_id,
          period_month: metric.period_month,
          term: metric.term,
          bank_balance: metric.bank_balance,
          inflow: metric.inflow,
          outflow: metric.outflow,
          assets: metric.assets,
          liabilities: metric.liabilities,
          receivables: metric.receivables,
          liquidity: metric.liquidity,
          equity: metric.equity,
          total_revenue: metric.total_revenue,
          total_cost: metric.total_cost,
          npm: metric.npm,
          gpm: metric.gpm,
          finance_health_index: metric.finance_health_index,
          finance_od_score: metric.finance_od_score,
          global_ranking: metric.global_ranking,
          ap_ranking: metric.ap_ranking,
        });
      }
    }

    if (metricsToInsert.length > 0) {
      console.log(`↕️ Upserting ${metricsToInsert.length} monthly metrics...`);
      const { error: metricsError } = await supabase
        .from("monthly_metrics")
        .upsert(metricsToInsert, {
          onConflict: "entity_id,period_month",
        });

      if (metricsError) {
        errors.push(`Monthly metrics insert failed: ${metricsError.message}`);
        console.error("❌", metricsError);
      } else {
        metricsInserted = metricsToInsert.length;
        console.log(`✅ Inserted ${metricsInserted} metrics`);
      }
    }

    // 5. Parse and insert revenue_streams
    if (config.revenueColumns) {
      console.log("⏳ Processing revenue streams...");
      const revenuesToInsert: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const monthStr = row[headers.findIndex((h) =>
          h.toLowerCase() === config.monthColumn?.toLowerCase()
        )];

        const revenues = mapSheetRowToRevenueStreams(
          row,
          headers,
          entityMap,
          monthStr,
          config
        );

        if (revenues) {
          revenuesToInsert.push(...revenues);
        }
      }

      if (revenuesToInsert.length > 0) {
        console.log(`↕️ Upserting ${revenuesToInsert.length} revenue stream rows...`);
        const { error: revenueError } = await supabase
          .from("revenue_streams")
          .upsert(revenuesToInsert, {
            onConflict: "entity_id,period_month,function_code",
          });

        if (revenueError) {
          errors.push(`Revenue streams insert failed: ${revenueError.message}`);
          console.error("❌", revenueError);
        } else {
          revenueInserted = revenuesToInsert.length;
          console.log(`✅ Inserted ${revenueInserted} revenue entries`);
        }
      }
    }

    // 6. Parse and insert cost_breakdown
    if (config.costColumns) {
      console.log("⏳ Processing cost breakdown...");
      const costsToInsert: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const monthStr = row[headers.findIndex((h) =>
          h.toLowerCase() === config.monthColumn?.toLowerCase()
        )];
        const entityName = row[headers.findIndex((h) =>
          h.toLowerCase() === config.entityNameColumn?.toLowerCase()
        )]?.toString().trim();

        if (!entityName) continue;
        const entityId = entityMap.get(entityName);
        if (!entityId) continue;

        // Parse month
        const periodMonth = parseMonthSimple(monthStr);
        if (!periodMonth) continue;

        // Process each cost function
        for (const [func, colName] of Object.entries(config.costColumns)) {
          const colIdx = headers.findIndex((h) => h.toLowerCase() === colName?.toLowerCase());
          const amount = parseFloat(
            String(row[colIdx] || 0).replace(/[^0-9.-]/g, "")
          );

          if (!isNaN(amount) && amount > 0) {
            costsToInsert.push({
              entity_id: entityId,
              period_month: periodMonth,
              function_code: func,
              amount,
            });
          }
        }
      }

      if (costsToInsert.length > 0) {
        console.log(`↕️ Upserting ${costsToInsert.length} cost breakdown rows...`);
        const { error: costError } = await supabase
          .from("cost_breakdown")
          .upsert(costsToInsert, {
            onConflict: "entity_id,period_month,function_code",
          });

        if (costError) {
          errors.push(`Cost breakdown insert failed: ${costError.message}`);
          console.error("❌", costError);
        } else {
          costInserted = costsToInsert.length;
          console.log(`✅ Inserted ${costInserted} cost entries`);
        }
      }
    }

    const message =
      errors.length === 0
        ? `✅ Sync complete! Inserted ${metricsInserted} metrics, ${revenueInserted} revenue, ${costInserted} cost entries`
        : `⚠️ Sync completed with ${errors.length} error(s)`;

    console.log(message);

    return {
      success: errors.length === 0,
      message,
      metricsInserted,
      revenueInserted,
      costInserted,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Sync failed:", message);
    errors.push(message);

    return {
      success: false,
      message: `Sync failed: ${message}`,
      metricsInserted,
      revenueInserted,
      costInserted,
      errors,
    };
  }
}

/**
 * Simple month parser (helper)
 */
function parseMonthSimple(monthStr: string): string | null {
  if (!monthStr) return null;

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

  const patterns = [
    /(\w+)\s+(\d{4})/,
    /(\w+)-(\d{4})/,
    /(\d{4})-(\d{1,2})/,
  ];

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
 * Trigger sync from admin endpoint
 */
export async function createSyncEndpoint() {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
      });
    }

    const result = await syncSheetData();
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  };
}
