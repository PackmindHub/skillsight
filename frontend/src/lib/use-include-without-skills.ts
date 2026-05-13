import { useSearchParams } from "react-router-dom";

export function useIncludeWithoutSkills(): {
	includeWithoutSkills: boolean;
	setIncludeWithoutSkills: (next: boolean) => void;
} {
	const [searchParams, setSearchParams] = useSearchParams();
	const includeWithoutSkills = searchParams.get("includeWithoutSkills") === "1";

	const setIncludeWithoutSkills = (next: boolean) => {
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (next) params.set("includeWithoutSkills", "1");
				else params.delete("includeWithoutSkills");
				return params;
			},
			{ replace: true },
		);
	};

	return { includeWithoutSkills, setIncludeWithoutSkills };
}
