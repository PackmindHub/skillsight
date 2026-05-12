import { useSearchParams } from "react-router-dom";

export function useIncludeIgnored(): {
	includeIgnored: boolean;
	setIncludeIgnored: (next: boolean) => void;
} {
	const [searchParams, setSearchParams] = useSearchParams();
	const includeIgnored = searchParams.get("includeIgnored") === "1";

	const setIncludeIgnored = (next: boolean) => {
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (next) params.set("includeIgnored", "1");
				else params.delete("includeIgnored");
				return params;
			},
			{ replace: true },
		);
	};

	return { includeIgnored, setIncludeIgnored };
}
