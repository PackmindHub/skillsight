import { spawn } from "node:child_process";
import type {
	IPackmindCliGateway,
	PackmindPackage,
	PackmindPackageDetail,
	PackmindPackageSkill,
	PackmindWhoami,
} from "@/domain/ports/packmind-cli-gateway";

export class PackmindCliError extends Error {
	constructor(
		message: string,
		readonly stdout: string,
		readonly stderr: string,
		readonly code: number | null,
	) {
		super(message);
		this.name = "PackmindCliError";
	}
}

interface RunResult {
	stdout: string;
	stderr: string;
	code: number | null;
}

const BIN = () => process.env.PACKMIND_CLI_BIN || "packmind-cli";

// First non-empty line of the input, trimmed and length-capped — for log lines
// where we want a one-line glimpse of failure output without flooding the log.
function firstLine(s: string, max = 200): string {
	for (const raw of s.split("\n")) {
		const line = raw.trim();
		if (line.length === 0) continue;
		return line.length > max ? `${line.slice(0, max)}…` : line;
	}
	return "";
}

function runCli(args: string[], apiKey: string): Promise<RunResult> {
	const bin = BIN();
	const cmd = `${bin} ${args.join(" ")}`;
	console.log(`[packmind-cli] $ ${cmd}`);
	const startedAt = Date.now();
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, {
			env: {
				...process.env,
				PACKMIND_API_KEY_V3: apiKey,
				NO_COLOR: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		child.stdout.on("data", (c) => stdoutChunks.push(Buffer.from(c)));
		child.stderr.on("data", (c) => stderrChunks.push(Buffer.from(c)));
		child.on("error", (err) => {
			console.error(
				`[packmind-cli] ✗ spawn failed (${Date.now() - startedAt}ms) — ${err.message}`,
			);
			reject(err);
		});
		child.on("close", (code) => {
			const stdout = Buffer.concat(stdoutChunks).toString("utf8");
			const stderr = Buffer.concat(stderrChunks).toString("utf8");
			const elapsed = Date.now() - startedAt;
			if (code === 0) {
				console.log(`[packmind-cli] ✓ exit 0 in ${elapsed}ms`);
			} else {
				const hint = firstLine(stderr) || firstLine(stdout);
				console.warn(
					`[packmind-cli] ✗ exit ${code} in ${elapsed}ms${hint ? ` — ${hint}` : ""}`,
				);
			}
			resolve({ stdout, stderr, code });
		});
	});
}

// Strips ANSI escape sequences and CLI progress chatter that the spinner prints
// to the terminal (e.g. "[2K[1A[2K[GFetching packages\n").
export function stripCliNoise(raw: string): string {
	// Strip ANSI CSI sequences and lone ESC.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping terminal control codes
	let s = raw.replace(/\[[0-9;?]*[A-Za-z]/g, "");
	// Strip standalone control sequences that some CLIs emit without the ESC
	// byte (we observed bare "[2K[1A[2K[G" mixed into stdout under certain
	// terminals). The bracket-form alone is enough of a fingerprint.
	s = s.replace(/\[\d*[A-Z]/g, "");
	// Drop "Fetching ..." progress lines.
	s = s
		.split("\n")
		.filter((line) => !/^(packmind-cli\s+)?Fetching\b/.test(line.trim()))
		.join("\n");
	return s;
}

function spaceNameFromSlug(slug: string): string {
	// "@backend/generic" → "@backend"
	const at = slug.indexOf("/");
	return at > 0 ? slug.slice(0, at) : slug;
}

export function parsePackagesList(raw: string): PackmindPackage[] {
	const cleaned = stripCliNoise(raw);
	const lines = cleaned.split("\n");
	const packages: PackmindPackage[] = [];

	let currentSpace: string | null = null;
	let pending: Partial<PackmindPackage> | null = null;

	const commit = () => {
		if (pending?.slug) {
			packages.push({
				slug: pending.slug,
				spaceSlug: spaceNameFromSlug(pending.slug),
				spaceName: currentSpace ?? "",
				displayName: pending.displayName ?? pending.slug,
				url: pending.url ?? null,
			});
		}
		pending = null;
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const trimmed = line.trim();
		const spaceMatch = /^Space:\s+(.+)$/.exec(trimmed);
		if (spaceMatch) {
			commit();
			currentSpace = spaceMatch[1].trim();
			continue;
		}
		const slugMatch = /^-\s+(@[a-z0-9._-]+\/[a-z0-9._-]+)\s*$/i.exec(trimmed);
		if (slugMatch) {
			commit();
			pending = { slug: slugMatch[1] };
			continue;
		}
		if (!pending) continue;
		const nameMatch = /^Name:\s+(.+)$/.exec(trimmed);
		if (nameMatch) {
			pending.displayName = nameMatch[1].trim();
			continue;
		}
		const urlMatch = /^(https?:\/\/\S+)$/.exec(trimmed);
		if (urlMatch) {
			pending.url = urlMatch[1];
			continue;
		}
		// Footer line — flush.
		if (/^How to install/i.test(trimmed)) {
			commit();
			break;
		}
		if (trimmed === "") {
			// Blank line — keep accumulating, the next non-blank may still be Name/url.
		}
	}
	commit();
	return packages;
}

export function parsePackageShow(raw: string, slug: string): PackmindPackageDetail {
	const cleaned = stripCliNoise(raw);
	const lines = cleaned.split("\n");

	// Title line like: "Generic (@backend/generic):"
	let displayName = slug;
	for (const line of lines) {
		const m = /^(.+)\s+\((@[^)]+)\):\s*$/.exec(line.trim());
		if (m && m[2] === slug) {
			displayName = m[1].trim();
			break;
		}
	}

	// Find the Skills: section. It runs until either EOF or the next "Section:"
	// header line (Standards:, Commands:, Skills:). We only care about Skills.
	const skills: PackmindPackageSkill[] = [];
	let inSkills = false;
	let currentSkill: PackmindPackageSkill | null = null;
	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const trimmed = line.trim();
		if (/^Skills:\s*$/.test(trimmed)) {
			inSkills = true;
			continue;
		}
		if (!inSkills) continue;
		// End the section on any other "Section:" header.
		if (/^[A-Z][A-Za-z ]+:\s*$/.test(trimmed) && trimmed !== "Skills:") {
			break;
		}
		const skillMatch = /^-\s+([a-z0-9._-]+)(?::\s*(.+))?$/i.exec(trimmed);
		if (skillMatch) {
			currentSkill = {
				name: skillMatch[1],
				description: skillMatch[2]?.trim() || null,
			};
			skills.push(currentSkill);
			continue;
		}
		// Continuation of the previous skill's description (indented, no leading "-").
		if (currentSkill && trimmed.length > 0 && !/^-/.test(trimmed)) {
			currentSkill.description = [currentSkill.description, trimmed]
				.filter(Boolean)
				.join(" ");
		}
	}

	return {
		slug,
		spaceSlug: spaceNameFromSlug(slug),
		spaceName: "",
		displayName,
		url: null,
		skills,
	};
}

export function parseWhoami(raw: string): PackmindWhoami {
	const cleaned = stripCliNoise(raw);
	const get = (re: RegExp) => {
		const m = re.exec(cleaned);
		return m ? m[1].trim() : "";
	};
	const host = get(/Host:\s*(\S+)/);
	const org = get(/Organization:\s*(\S+)/);
	const user = get(/User:\s*(\S+)/);
	if (!user || !org) {
		throw new PackmindCliError(
			"Could not parse `packmind-cli whoami` output",
			raw,
			"",
			0,
		);
	}
	return { user, org, host };
}

function isAuthError(stdout: string, stderr: string): boolean {
	const combined = `${stdout}\n${stderr}`.toLowerCase();
	return (
		combined.includes("not authenticated") ||
		combined.includes("expired") ||
		combined.includes("invalid api key") ||
		combined.includes("unauthorized")
	);
}

async function run(args: string[], apiKey: string): Promise<string> {
	const { stdout, stderr, code } = await runCli(args, apiKey);
	if (code === 0) return stdout;
	throw new PackmindCliError(
		isAuthError(stdout, stderr)
			? "Packmind: not authenticated (check the API key)"
			: `packmind-cli ${args.join(" ")} exited with code ${code}`,
		stdout,
		stderr,
		code,
	);
}

export class PackmindCliGateway implements IPackmindCliGateway {
	async whoami(apiKey: string): Promise<PackmindWhoami> {
		return parseWhoami(await run(["whoami"], apiKey));
	}

	async listPackages(apiKey: string): Promise<PackmindPackage[]> {
		return parsePackagesList(await run(["packages", "list"], apiKey));
	}

	async showPackage(apiKey: string, slug: string): Promise<PackmindPackageDetail> {
		return parsePackageShow(await run(["packages", "show", slug], apiKey), slug);
	}
}
