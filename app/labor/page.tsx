import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LaborReportChart } from "@/components/labor-report-chart";
import { formatCurrency, formatDate } from "@/lib/utils";
import { repairLaborCents } from "@/lib/calculations";

interface RepairWithUnit {
    id: string;
    unit_id: string;
    started_at: string;
    labor_hours: number;
    labor_rate_cents: number;
    notes: string | null;
    units: { id: string; model: string; generation: string | null; serial_number: string | null } | null;
}

function unitLabel(u: NonNullable<RepairWithUnit["units"]>) {
    return [u.model, u.generation, u.serial_number].filter(Boolean).join(" · ");
}

export default async function LaborPage() {
    const supabase = createClient();
    const { data: repairs, error } = await supabase
        .from("repairs")
        .select("*, units(id, model, generation, serial_number)")
        .order("started_at", { ascending: false });

    if (error) {
        return (
            <div className="space-y-2">
                <h1 className="text-xl font-medium">Labor</h1>
                <p className="text-sm text-destructive">Couldn&apos;t load repair logs: {error.message}</p>
            </div>
        );
    }

    const rows = (repairs ?? []) as RepairWithUnit[];

    const totalHours = rows.reduce((s, r) => s + r.labor_hours, 0);
    const totalCents = rows.reduce((s, r) => s + repairLaborCents(r), 0);
    const avgRateCents = totalHours > 0 ? Math.round(totalCents / totalHours) : 0;

    // Monthly breakdown, oldest → newest, for the chart.
    const byMonth = new Map<string, { label: string; cents: number }>();
    for (const r of rows) {
        const d = new Date(r.started_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const entry = byMonth.get(key) ?? { label, cents: 0 };
        entry.cents += repairLaborCents(r);
        byMonth.set(key, entry);
    }
    const monthlyData = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);

    // By-unit breakdown, highest labor value first.
    const byUnit = new Map<string, { unit: RepairWithUnit["units"]; hours: number; cents: number }>();
    for (const r of rows) {
        if (!r.units) continue;
        const entry = byUnit.get(r.unit_id) ?? { unit: r.units, hours: 0, cents: 0 };
        entry.hours += r.labor_hours;
        entry.cents += repairLaborCents(r);
        byUnit.set(r.unit_id, entry);
    }
    const unitBreakdown = Array.from(byUnit.entries())
        .map(([unitId, v]) => ({ unitId, ...v }))
        .sort((a, b) => b.cents - a.cents);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-medium">Labor</h1>
                <p className="text-sm text-muted-foreground">
                    What your logged repair time has been worth, at the rate each entry was billed.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Total labor value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-mono text-2xl font-medium">{formatCurrency(totalCents)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Total hours logged
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-mono text-2xl font-medium">{totalHours.toFixed(1)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Avg rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-mono text-2xl font-medium">
                            {totalHours > 0 ? `${formatCurrency(avgRateCents)}/hr` : "—"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {monthlyData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Labor value by month</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <LaborReportChart data={monthlyData} />
                    </CardContent>
                </Card>
            )}

            {unitBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">By unit</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {unitBreakdown.map(({ unitId, unit, hours, cents }) => (
                            <div key={unitId} className="flex items-center justify-between text-sm">
                                <Link href={`/units/${unitId}`} className="hover:underline">
                                    {unit ? unitLabel(unit) : "Unknown unit"}
                                </Link>
                                <div className="flex items-center gap-4 font-mono text-xs">
                                    <span className="text-muted-foreground">{hours.toFixed(1)}h</span>
                                    <span>{formatCurrency(cents)}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {rows.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No labor logged yet — add time from a unit&apos;s Repair history section.
                        </p>
                    )}
                    {rows.map((r) => (
                        <div key={r.id} className="flex items-start justify-between rounded-md border border-border p-3 text-sm">
                            <div>
                                <p>{formatDate(r.started_at)}</p>
                                {r.units && (
                                    <Link href={`/units/${r.unit_id}`} className="text-xs text-primary hover:underline">
                                        {unitLabel(r.units)}
                                    </Link>
                                )}
                                {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                            </div>
                            <div className="text-right font-mono text-xs text-muted-foreground">
                                <p>
                                    {r.labor_hours}h @ {formatCurrency(r.labor_rate_cents)}/hr
                                </p>
                                <p className="text-foreground">{formatCurrency(repairLaborCents(r))}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}