import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "primary" | "teal" | "orange" | "purple" | "green" | "red";
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-aiesec-teal/15 text-aiesec-teal",
    orange: "bg-aiesec-orange/15 text-aiesec-orange",
    purple: "bg-aiesec-purple/15 text-aiesec-purple",
    green: "bg-aiesec-green/15 text-aiesec-green",
    red: "bg-aiesec-red/15 text-aiesec-red",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && <div className={`flex h-9 w-9 items-center justify-center rounded-md ${accentMap[accent]}`}>{icon}</div>}
      </CardContent>
    </Card>
  );
}
