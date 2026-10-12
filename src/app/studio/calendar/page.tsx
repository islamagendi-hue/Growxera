import Link from "next/link";
import { first, StatusBadge } from "@/components/studio/StudioUi";
import { select } from "@/lib/server/store";
import { calendarMonth, loadPosts, riyadhDay, shiftMonth, type CalendarDay, type CalendarEntry } from "@/lib/studio/insights";
import { requireOwner } from "@/lib/studio/owner";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const monthName = (m: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export default async function Calendar({ searchParams }: PageProps<"/studio/calendar">) {
  await requireOwner();
  const today = riyadhDay(new Date().toISOString());
  const wanted = first((await searchParams).month);
  const month = wanted && /^\d{4}-(0[1-9]|1[0-2])$/.test(wanted) ? wanted : today.slice(0, 7);
  const [posts, history] = await Promise.all([
    loadPosts(),
    select<{ published_at: string | null; text: string; external_url: string | null }>("li_content", [], { columns: "published_at,text,external_url" }),
  ]);
  const days = calendarMonth(month, posts, history);
  const inMonth = days.filter((d) => d.inMonth);
  const planned = inMonth.flatMap((d) => d.entries.filter((e) => e.type === "planned"));
  const conflicts = inMonth.filter((d) => d.conflict).length;
  const missed = planned.filter((e) => e.post!.overdue || e.post!.held).length;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-ink-2">Riyadh time. Planned posts and published history.</p>
        </div>
        <nav aria-label="Month" className="flex items-center gap-3 text-sm">
          <Link href={`/studio/calendar?month=${shiftMonth(month, -1)}`} className="border border-line px-3 py-1 hover:bg-paper-2">
            ← Previous
          </Link>
          <span className="font-semibold">{monthName(month)}</span>
          <Link href={`/studio/calendar?month=${shiftMonth(month, 1)}`} className="border border-line px-3 py-1 hover:bg-paper-2">
            Next →
          </Link>
          {month !== today.slice(0, 7) && (
            <Link href="/studio/calendar" className="underline underline-offset-4">
              Today
            </Link>
          )}
        </nav>
      </div>

      <p className="mt-4 text-sm text-ink-2">
        {planned.length} planned this month
        {conflicts > 0 && <span className="text-alert"> · {conflicts} day{conflicts === 1 ? "" : "s"} with more than one post</span>}
        {missed > 0 && <span className="text-alert"> · {missed} missed or held</span>}. To change a time, open the post and edit it: that saves a new version and
        needs a new approval.
      </p>

      {/* Month grid on wide screens. */}
      <div className="mt-6 hidden border border-line bg-line md:block">
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-paper-2 px-2 py-1 text-xs font-medium text-ink-2">
              {d}
            </div>
          ))}
          {days.map((day) => (
            <DayCell key={day.date} day={day} today={today} />
          ))}
        </div>
      </div>

      {/* Agenda on phones: only days with something on them. */}
      <ol className="mt-6 space-y-4 md:hidden">
        {inMonth.filter((d) => d.entries.length).length === 0 && <li className="border border-line bg-card p-4 text-sm text-ink-2">Nothing this month.</li>}
        {inMonth
          .filter((d) => d.entries.length)
          .map((day) => (
            <li key={day.date} className={`border bg-card p-3 ${day.conflict ? "border-alert" : "border-line"}`}>
              <p className="text-sm font-semibold">
                {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}
                {day.date === today && <span className="ml-2 font-mono text-xs text-accent-ink">Today</span>}
                {day.conflict && <span className="ml-2 font-mono text-xs text-alert">More than one post</span>}
              </p>
              <ul className="mt-2 space-y-2">
                {day.entries.map((e, i) => (
                  <Entry key={i} e={e} />
                ))}
              </ul>
            </li>
          ))}
      </ol>

      <p className="mt-4 text-xs text-ink-3">
        Legend: status badges show the post&apos;s state · <span className="text-accent-ink">Auto</span> confirmed for automatic publishing ·{" "}
        <span className="text-alert">Missed / Held</span> its time passed · grey items were already published.
      </p>
    </div>
  );
}

function DayCell({ day, today }: { day: CalendarDay; today: string }) {
  return (
    <div className={`min-h-28 bg-card p-2 ${day.inMonth ? "" : "opacity-50"} ${day.conflict ? "outline outline-1 -outline-offset-1 outline-alert" : ""}`}>
      <p className={`text-xs ${day.date === today ? "font-semibold text-accent-ink" : "text-ink-3"}`}>
        {Number(day.date.slice(8))}
        {day.conflict && <span className="ml-1 text-alert">· 2+</span>}
      </p>
      <ul className="mt-1 space-y-1">
        {day.entries.map((e, i) => (
          <Entry key={i} e={e} compact />
        ))}
      </ul>
    </div>
  );
}

function Entry({ e, compact = false }: { e: CalendarEntry; compact?: boolean }) {
  if (e.type === "published") {
    return (
      <li className="text-xs text-ink-3">
        {time(e.at)} {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{e.title}</a> : e.title}
      </li>
    );
  }
  const p = e.post!;
  return (
    <li>
      <Link href={`/studio/queue/${p.action.id}`} className="block text-xs hover:underline">
        <span className="font-mono">{time(e.at)}</span> {!compact && <StatusBadge status={p.action.status} />}{" "}
        {p.autoAuthorized && <span className="font-mono text-accent-ink">Auto</span>}
        {(p.overdue || p.held) && <span className="font-mono text-alert">{p.held ? "Held" : "Missed"}</span>}
        <span className={`block ${compact ? "line-clamp-2" : ""}`}>{compact ? `${p.action.status === "approved" ? "✓ " : ""}${p.title}` : p.title}</span>
      </Link>
    </li>
  );
}
