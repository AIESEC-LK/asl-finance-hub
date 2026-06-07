import { useState } from "react";
import { syncSheetData } from "@/integrations/googleSheets/sync";
import type { SyncResult } from "@/integrations/googleSheets";

export type SyncMode = "all" | "term" | "current";

export interface SyncOptions {
  mode: SyncMode;
  term?: string; // e.g. "24-25" — required when mode === "term"
  month?: string; // ISO first-of-month e.g. "2026-06-01" — auto-set when mode === "current"
}

export interface ExtendedSyncResult extends SyncResult {
  webhookRows?: number;
  webhookWarnings?: string[];
}

export function useSheetSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async (options: SyncOptions) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const webhookUrl = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL as string | undefined;
      const webhookSecret = import.meta.env.VITE_APPSCRIPT_SECRET as string | undefined;

      if (!webhookUrl)
        throw new Error("VITE_APPSCRIPT_WEBHOOK_URL not set in .env — complete Gate 1 first.");

      const month =
        options.mode === "current"
          ? (() => {
              const d = new Date();
              d.setDate(1);
              return d.toISOString().slice(0, 10);
            })()
          : (options.month ?? null);

      // ── Step 1: trigger AppScript to rebuild MASTER_COMBINED_TALL ──
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: webhookSecret ?? "",
          mode: options.mode,
          term: options.term ?? null,
          month,
        }),
      });

      if (!webhookRes.ok) {
        throw new Error(`AppScript webhook HTTP error: ${webhookRes.status}`);
      }

      const webhookData = (await webhookRes.json()) as {
        ok: boolean;
        error?: string;
        rowsWritten?: number;
        warnings?: string[];
      };

      if (!webhookData.ok) {
        throw new Error(`AppScript error: ${webhookData.error ?? "unknown"}`);
      }

      // ── Step 2: pull updated master sheet into Supabase ──
      const res = await syncSheetData();
      setResult({
        ...res,
        webhookRows: webhookData.rowsWritten,
        webhookWarnings: webhookData.warnings ?? [],
      });
      if (!res.success) setError(res.errors.join("; "));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { sync, loading, result, error };
}
