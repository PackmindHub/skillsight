import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Compare the second half of a daily-counts series to the first half and return
// the percent change rounded to an integer. Trims to even length from the front
// (keeps today) so both halves span the same number of days — otherwise an
// odd-length window (e.g. 7d) puts 3 vs 4 days on each side and mechanically
// over-reports growth by ~33%.
export function computeDeltaPct(dailyCounts: number[]): number {
	const evenLen = dailyCounts.length - (dailyCounts.length % 2);
	if (evenLen < 4) return 0;
	const start = dailyCounts.length - evenLen;
	const mid = start + evenLen / 2;
	const first = dailyCounts.slice(start, mid).reduce((a, b) => a + b, 0);
	const second = dailyCounts.slice(mid).reduce((a, b) => a + b, 0);
	if (first === 0) return second > 0 ? 100 : 0;
	return Math.round(((second - first) / first) * 100);
}

// True when `iso` (a YYYY-MM-DD month-start from DATE_TRUNC) falls in the
// current UTC month — used to flag the trailing monthly bucket as partial
// since its aggregation is still accruing.
export function isCurrentUtcMonth(iso: string, now: Date = new Date()): boolean {
	return iso.slice(0, 7) === `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Sum activation counts for the three known invocation triggers. Anything
// outside this set (null, a future trigger value, etc.) is the caller's
// responsibility — typically computed as `totalActivations - sum(known)`.
export function sumKnownTriggers(
	byTrigger: Array<{ trigger: string | null; count: number }>,
): { user: number; claude: number; nested: number } {
	const totals = { user: 0, claude: 0, nested: 0 };
	for (const t of byTrigger) {
		if (t.trigger === "user-slash") totals.user += t.count;
		else if (t.trigger === "claude-proactive") totals.claude += t.count;
		else if (t.trigger === "nested-skill") totals.nested += t.count;
	}
	return totals;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
	const then = new Date(iso);
	const diffMs = now.getTime() - then.getTime();
	const diffSec = Math.round(diffMs / 1000);

	if (diffSec < 0) return "just now";
	if (diffSec < 10) return "just now";
	if (diffSec < 60) return `${diffSec} seconds ago`;

	const diffMin = Math.round(diffSec / 60);
	if (diffMin < 60) return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;

	const diffHr = Math.round(diffMin / 60);
	if (diffHr < 24) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;

	const diffDay = Math.round(diffHr / 24);
	if (diffDay === 1) return "yesterday";
	if (diffDay < 7) return `${diffDay} days ago`;

	return formatDateTime(iso);
}
