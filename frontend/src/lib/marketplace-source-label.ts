import type { MarketplaceSource } from "@/types/api";

// Single source of truth for "what do we call this marketplace source in the UI".
// Git sources are displayed by their git URL; Packmind sources by their user-
// chosen marketplace name prefixed with "Packmind ·" so the provenance is
// visible at a glance.
export function sourceDisplayLabel(source: MarketplaceSource): string {
	if (source.kind === "packmind") {
		return `Packmind · ${source.marketplaceName ?? ""}`;
	}
	return source.gitUrl ?? "(no url)";
}
