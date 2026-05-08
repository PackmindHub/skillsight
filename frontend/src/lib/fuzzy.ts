// Tiny fuzzy scorer: returns null if no match, else a score where lower is better.
// Matches are case-insensitive and accept characters in order with gaps.
// Bonus weight for exact substring + start-of-string matches.
export function fuzzyScore(query: string, target: string): number | null {
	if (!query) return 0;
	const q = query.toLowerCase();
	const t = target.toLowerCase();

	const exact = t.indexOf(q);
	if (exact === 0) return -1000;
	if (exact > 0) return -500 + exact;

	let qi = 0;
	let lastMatch = -1;
	let gaps = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			if (lastMatch >= 0) gaps += ti - lastMatch - 1;
			lastMatch = ti;
			qi++;
		}
	}
	if (qi < q.length) return null;
	return gaps + (lastMatch - q.length + 1) * 0.1;
}
