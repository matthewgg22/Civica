export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { formatDateTime, decryptDemoName, firstNameLastInitial } from "../../lib/format";
import { OutreachTaskActions } from "./OutreachTaskActions";

type OutreachTask = {
  outreach_task_id: string;
  packet_id: string;
  reason: string;
  income_usd: number | null;
  sla_hours: number | null;
  due_at: string;
  status: string;
  created_at: string;
};

type Packet = {
  packet_id: string;
  status: string;
  county: string | null;
  state_code: string;
  applicants: { full_name_ciphertext: string | null } | null;
};

type UrgencyLevel = "overdue" | "due-soon" | "on-track";

function getUrgency(dueAt: string): UrgencyLevel {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diffMs = due - now;
  if (diffMs < 0) return "overdue";
  if (diffMs <= 2 * 60 * 60 * 1000) return "due-soon";
  return "on-track";
}

const URGENCY_STYLES: Record<UrgencyLevel, { dot: string; label: string; badge: string }> = {
  "overdue":   { dot: "bg-brick",  label: "Overdue",  badge: "bg-brick/10 text-brick" },
  "due-soon":  { dot: "bg-amber",  label: "Due soon", badge: "bg-amber/15 text-amber" },
  "on-track":  { dot: "bg-graphite", label: "On track", badge: "bg-surface text-graphite border border-hairline" },
};

const REASON_LABELS: Record<string, string> = {
  cliff_event: "Income cliff",
  manual: "Manual",
};

export default async function OutreachPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // Query 1: pending outreach tasks
  const { data: tasks, error } = await supabase
    .schema("snap_enrollment")
    .from("navigator_outreach_queue")
    .select("outreach_task_id, packet_id, reason, income_usd, sla_hours, due_at, status, created_at")
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(100);

  // Query 2: packets for context
  const taskList = (tasks ?? []) as OutreachTask[];
  const packetIds = taskList.map((t) => t.packet_id);
  const { data: packets } = packetIds.length > 0
    ? await supabase
        .schema("snap_enrollment")
        .from("snap_packets")
        .select("packet_id, status, county, state_code, applicants(full_name_ciphertext)")
        .in("packet_id", packetIds)
        .is("deleted_at", null)
    : { data: [] as Packet[] };

  const packetList = (packets ?? []) as Packet[];
  const packetMap = new Map<string, Packet>(
    packetList.map((p) => [p.packet_id, p])
  );
  const pendingCount = taskList.length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} active="outreach" />

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-baseline gap-3 mb-2">
          <Link href="/dashboard" className="text-[13px] text-muted hover:text-ink transition-colors">
            ← Dashboard
          </Link>
          <span className="text-muted text-[13px]">|</span>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-ink">
            Outreach Queue
          </h1>
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-brick/10 text-brick">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-[14px] text-muted mb-8">
          Pending applicant outreach · Ordered by due date
        </p>

        {error && (
          <div className="bg-brick/10 border border-brick/30 text-brick rounded-[4px] p-4 mb-6 text-[13px]">
            {error.message}
          </div>
        )}

        {taskList.length === 0 && !error ? (
          <div className="text-center py-20 bg-surface border border-hairline rounded-[4px]">
            <p className="text-[17px] font-medium text-graphite">No pending outreach tasks</p>
            <p className="text-[13px] mt-1.5 text-muted">The queue is clear.</p>
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
            {taskList.map((task, i) => {
              const packet = packetMap.get(task.packet_id);
              const applicant = packet?.applicants;
              const rawName = decryptDemoName(applicant?.full_name_ciphertext ?? null);
              const displayName =
                rawName === "Unknown" || rawName === "[redacted]" || rawName === "[encrypted]"
                  ? rawName
                  : firstNameLastInitial(rawName);

              const urgency = getUrgency(task.due_at);
              const urgencyStyle = URGENCY_STYLES[urgency];
              const reasonLabel = REASON_LABELS[task.reason] ?? task.reason;
              const incomeStr = task.income_usd != null
                ? `$${task.income_usd.toLocaleString("en-US")}/mo`
                : null;

              return (
                <div
                  key={task.outreach_task_id}
                  className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}
                >
                  {/* Urgency indicator dot */}
                  <div className="pt-1 shrink-0">
                    <span
                      className={`block w-2.5 h-2.5 rounded-full ${urgencyStyle.dot}`}
                      title={urgencyStyle.label}
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-[15px] font-semibold text-ink">
                        {displayName}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${urgencyStyle.badge}`}
                      >
                        {urgencyStyle.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mt-1.5">
                      {/* Reason badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal/10 text-teal">
                        {reasonLabel}
                      </span>

                      {/* Income */}
                      {incomeStr && (
                        <span className="text-[13px] text-graphite tabular-nums">
                          {incomeStr}
                        </span>
                      )}

                      {/* Due */}
                      <span className="text-[13px] text-muted">
                        Due {formatDateTime(task.due_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions + link */}
                  <div className="flex items-center gap-3 shrink-0">
                    <OutreachTaskActions taskId={task.outreach_task_id} />
                    <Link
                      href={`/packets/${task.packet_id}`}
                      className="text-[13px] font-semibold text-teal hover:underline whitespace-nowrap"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
