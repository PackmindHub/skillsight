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
