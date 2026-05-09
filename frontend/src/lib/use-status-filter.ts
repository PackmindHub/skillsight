import type { AnyStatus } from "@/components/ui/StatusBadge";
import { useSearchParams } from "react-router-dom";

export function useStatusFilter<S extends AnyStatus>(
	paramKey: string,
	allowed: readonly S[],
): { status: S | "all"; setStatus: (next: S | "all") => void } {
	const [searchParams, setSearchParams] = useSearchParams();
	const raw = searchParams.get(paramKey);
	const status: S | "all" = (allowed as readonly string[]).includes(raw ?? "")
		? (raw as S)
		: "all";

	const setStatus = (next: S | "all") => {
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (next === "all") params.delete(paramKey);
				else params.set(paramKey, next);
				return params;
			},
			{ replace: true },
		);
	};

	return { status, setStatus };
}
