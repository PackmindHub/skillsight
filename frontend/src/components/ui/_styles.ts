/**
 * Shared className constants for UI primitives.
 *
 * Consumed by Input/Select/FormField as well as the legacy primitives
 * SearchBar/MultiSelect/StatusFilter/Menu. Compose with cn() so callers can
 * merge or override via tailwind-merge.
 */

export const INPUT_BASE =
	"rounded-md border border-edge bg-surface-800 text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-1 focus:ring-accent-bright focus:border-accent-bright disabled:opacity-50 disabled:cursor-not-allowed";

export const INPUT_SIZE = {
	sm: "h-8 px-3 text-sm",
	md: "h-9 px-3 text-sm",
} as const;

export type InputSize = keyof typeof INPUT_SIZE;

export const INPUT_INVALID =
	"border-danger/60 focus:ring-danger focus:border-danger";

export const DROPDOWN_PANEL =
	"absolute z-30 mt-1 rounded-md border border-edge bg-surface-800 py-1 shadow-xl";

export const MENU_ITEM_BASE =
	"flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed";
