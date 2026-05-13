// Minimal semver comparator for "latest version" selection. Not a full semver
// parser — handles MAJOR.MINOR.PATCH with optional `-pre` and `+build` per
// https://semver.org. Strings that don't parse rank below every parseable
// version; ties between unparseable strings fall back to lexical order.

interface Parsed {
	major: number;
	minor: number;
	patch: number;
	pre: string[] | null;
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemver(v: string): Parsed | null {
	const m = VERSION_RE.exec(v.trim());
	if (!m) return null;
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		pre: m[4] ? m[4].split(".") : null,
	};
}

function comparePre(a: string[] | null, b: string[] | null): number {
	// No pre-release ranks higher than any pre-release. (1.0.0 > 1.0.0-alpha)
	if (a === null && b === null) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const ai = a[i];
		const bi = b[i];
		const an = /^\d+$/.test(ai) ? Number(ai) : null;
		const bn = /^\d+$/.test(bi) ? Number(bi) : null;
		if (an !== null && bn !== null) {
			if (an !== bn) return an < bn ? -1 : 1;
		} else if (an !== null) {
			return -1; // numeric < alphanumeric
		} else if (bn !== null) {
			return 1;
		} else if (ai !== bi) {
			return ai < bi ? -1 : 1;
		}
	}
	if (a.length !== b.length) return a.length < b.length ? -1 : 1;
	return 0;
}

export function compareSemver(a: string, b: string): number {
	const pa = parseSemver(a);
	const pb = parseSemver(b);
	if (pa === null && pb === null) return a < b ? -1 : a > b ? 1 : 0;
	if (pa === null) return -1;
	if (pb === null) return 1;
	if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
	if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
	if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
	return comparePre(pa.pre, pb.pre);
}

export function maxSemver(versions: readonly string[]): string | null {
	if (versions.length === 0) return null;
	let best = versions[0];
	for (let i = 1; i < versions.length; i++) {
		if (compareSemver(versions[i], best) > 0) best = versions[i];
	}
	return best;
}
