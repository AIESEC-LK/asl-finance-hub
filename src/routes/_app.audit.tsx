import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchEntities, type Entity } from "@/lib/finance";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

/** Audit term starts July 2025 — the date filter must not go before this. */
const AUDIT_MIN_DATE = "2025-07-01";

/** Line colors for the per-entity comparison charts (cycled). */
const ENTITY_COLORS = [
  "var(--aiesec-blue)",
  "var(--aiesec-teal)",
  "var(--aiesec-orange)",
  "var(--aiesec-red)",
  "var(--aiesec-purple)",
  "var(--aiesec-green)",
  "var(--aiesec-yellow)",
  "var(--aiesec-gray)",
];

interface AuditRow {
  entity_id: string;
  period_month: string;
  quarter: string | null;
  score: number | null;
  max_score: number | null;
  remarks: string | null;
}

interface Cell {
  score: number | null;
  remarks: string | null;
}

/** Score is stored as a 0..1 fraction; guard legacy 0..100 rows too. */
function toPct(score: number | null): number | null {
  if (score === null || score === undefined) return null;
  return score <= 1 ? score * 100 : score;
}

function AuditPage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters(),
    from: AUDIT_MIN_DATE,
  });
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  useEffect(() => {
    const lock = isLC && !isMC && !isEFB;
    const eid = lock ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;
    (async () => {
      let q = supabase
        .from("audit_scores")
        .select("entity_id,period_month,quarter,score,max_score,remarks")
        .order("period_month", { ascending: true });
      if (eid) q = q.eq("entity_id", eid);
      if (filters.from) q = q.gte("period_month", filters.from);
      if (filters.to) q = q.lte("period_month", filters.to);
      const { data } = await q;
      setRows((data ?? []) as AuditRow[]);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  // Pivot the tall rows into an LC × month matrix + per-entity chart series.
  const { months, entityRows, get, scoreSeries, qiSeries } = useMemo(() => {
    const monthSet = new Set<string>();
    const byEntity = new Map<string, Map<string, Cell>>();
    rows.forEach((r) => {
      monthSet.add(r.period_month);
      if (!byEntity.has(r.entity_id)) byEntity.set(r.entity_id, new Map());
      byEntity.get(r.entity_id)!.set(r.period_month, { score: r.score, remarks: r.remarks });
    });
    const months = Array.from(monthSet).sort();
    const entityRows = Array.from(byEntity.keys())
      .map((id) => ({ id, name: entityName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const get = (eid: string, m: string): Cell | null => byEntity.get(eid)?.get(m) ?? null;
    const label = (m: string) => format(parseISO(m), "MMM yy");

    // One row per month; one keyed column per entity → one Line each.
    type ChartRow = Record<string, number | string | null>;
    const scoreSeries: ChartRow[] = months.map((m) => {
      const row: ChartRow = { label: label(m) };
      entityRows.forEach((e) => {
        row[e.name] = toPct(get(e.id, m)?.score ?? null);
      });
      return row;
    });
    // Quality improvement = month-over-month Δ of score (derived, not stored).
    const qiSeries: ChartRow[] = months.map((m, i) => {
      const row: ChartRow = { label: label(m) };
      entityRows.forEach((e) => {
        if (i === 0) {
          row[e.name] = null;
          return;
        }
        const cur = toPct(get(e.id, m)?.score ?? null);
        const prev = toPct(get(e.id, months[i - 1])?.score ?? null);
        row[e.name] = cur !== null && prev !== null ? Math.round(cur - prev) : null;
      });
      return row;
    });

    return { months, entityRows, get, scoreSeries, qiSeries };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, entities]);

  const exportCSV = () => {
    const header = "Entity,Period,Result,Score";
    const body = rows
      .map((r) =>
        [
          entityName(r.entity_id),
          r.period_month,
          r.remarks ?? "",
          toPct(r.score)?.toFixed(0) ?? "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const empty = entityRows.length === 0 || months.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">EFB Audit Performance</h2>
          <p className="text-sm text-muted-foreground">
            Monthly audit results, scores &amp; quality improvement across LCs.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <Filters value={filters} onChange={setFilters} minDate={AUDIT_MIN_DATE} />

      {empty ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No audit data for the selected filters.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Audit Results ── */}
          <AuditMatrix
            title="Audit Results"
            months={months}
            entityRows={entityRows}
            renderCell={(eid, month) => {
              const cell = get(eid, month);
              const r = cell?.remarks?.trim().toLowerCase();
              if (r === "pass")
                return (
                  <CheckCircle2 className="mx-auto h-5 w-5 text-aiesec-green" aria-label="Pass" />
                );
              if (r === "fail")
                return <XCircle className="mx-auto h-5 w-5 text-aiesec-red" aria-label="Fail" />;
              return <span className="text-muted-foreground">—</span>;
            }}
          />

          {/* ── Audit Scores (trend; one line per LC for comparison) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Scores — trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreSeries} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => (v == null ? "—" : `${Number(v).toFixed(0)}%`)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {entityRows.map((e, i) => (
                    <Line
                      key={e.id}
                      type="monotone"
                      dataKey={e.name}
                      stroke={ENTITY_COLORS[i % ENTITY_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Quality Improvement (month-over-month Δ of score) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Quality Improvement</CardTitle>
            </CardHeader>
            <CardContent className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qiSeries} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Tooltip
                    formatter={(v) =>
                      v == null ? "—" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(0)}%`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {entityRows.map((e, i) => (
                    <Line
                      key={e.id}
                      type="monotone"
                      dataKey={e.name}
                      stroke={ENTITY_COLORS[i % ENTITY_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Reusable LC × month matrix card. */
function AuditMatrix({
  title,
  months,
  entityRows,
  renderCell,
}: {
  title: string;
  months: string[];
  entityRows: { id: string; name: string }[];
  renderCell: (entityId: string, month: string, monthIndex: number) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">LC</TableHead>
                {months.map((m) => (
                  <TableHead key={m} className="whitespace-nowrap text-center">
                    {format(parseISO(m), "MMM yyyy")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entityRows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium">{e.name}</TableCell>
                  {months.map((m, i) => (
                    <TableCell key={m} className="text-center">
                      {renderCell(e.id, m, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
