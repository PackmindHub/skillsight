import { MarketplaceDetailsDrawer } from "@/components/marketplaces/MarketplaceDetailsDrawer";
import { SourceErrorBanner } from "@/components/marketplaces/SourceErrorBanner";
import {
	Button,
	Card,
	FormField,
	IncludeIgnoredToggle,
	Input,
	PageHeader,
	StatusChip,
	type StatusChipOption,
} from "@/components/ui";
import { useMarketplaceSourcesHealth } from "@/context/MarketplaceSourcesHealthContext";
import { api } from "@/lib/api";
import { useIncludeIgnored } from "@/lib/use-include-ignored";
import { cn, formatRelativeShort, repoSlugFromGitUrl } from "@/lib/utils";
import type { Marketplace, MarketplaceSource, MarketplaceStatus } from "@/types/api";
import {
	ExternalLink,
	GitBranch,
	Link2Off,
	Loader2,
	Pencil,
	Play,
	RefreshCw,
	Trash2,
} from "lucide-react";
import {
	type FormEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSearchParams } from "react-router-dom";

const MARKETPLACE_STATUS_CHIP_OPTIONS: readonly StatusChipOption<MarketplaceStatus>[] = [
	{ value: "approved", label: "Approved", tone: "success" },
	{ value: "to_review", label: "To review", tone: "warning" },
	{ value: "denied", label: "Denied", tone: "danger" },
	{ value: "ignored", label: "Ignored", tone: "neutral" },
];

const MP_FILTER_OPTIONS: {
	key: "all" | MarketplaceStatus;
	label: string;
	dot?: string;
}[] = [
	{ key: "all", label: "All" },
	{ key: "to_review", label: "To review", dot: "var(--color-warning)" },
	{ key: "approved", label: "Approved", dot: "var(--color-success)" },
	{ key: "denied", label: "Denied", dot: "var(--color-danger)" },
	{ key: "ignored", label: "Ignored", dot: "var(--color-text-3)" },
];

const MP_GRID_COLS =
	"grid-cols-[minmax(300px,2.4fr)_60px_60px_110px_70px_70px_80px_100px_120px_104px]";

const LOGO_GRADIENTS = [
	"linear-gradient(135deg, var(--color-accent-bright), color-mix(in srgb, var(--color-accent-bright) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-accent-2), color-mix(in srgb, var(--color-accent-2) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-magenta), color-mix(in srgb, var(--color-magenta) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-danger), color-mix(in srgb, var(--color-danger) 50%, var(--color-surface-700)))",
];

function hashIndex(input: string, mod: number): number {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = (h * 31 + input.charCodeAt(i)) | 0;
	}
	return Math.abs(h) % mod;
}

function initialsFromName(name: string): string {
	const parts = name.split(/[-_\s]/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

function MarketplaceLogo({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
	const gradient = LOGO_GRADIENTS[hashIndex(name, LOGO_GRADIENTS.length)];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-surface-950",
				size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[11px]",
			)}
			style={{ background: gradient }}
		>
			{initialsFromName(name)}
		</span>
	);
}
function MarketplaceNumCell({
	value,
	onClick,
	href,
	title,
	dimWhenZero,
}: {
	value: number;
	onClick?: () => void;
	href?: string;
	title?: string;
	dimWhenZero?: boolean;
}) {
	const isZero = value === 0;
	const dim = isZero || dimWhenZero === undefined ? isZero : false;
	const display = isZero && dimWhenZero ? "—" : value.toLocaleString("en-US");
	const cls = cn("font-mono text-[15px] tabular-nums", dim ? "text-text-4" : "text-text-1");

	if (href && !isZero) {
		return (
			<div className="text-right">
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					title={title}
					className={cn(cls, "hover:underline")}
				>
					{display}
				</a>
			</div>
		);
	}
	if (onClick && !isZero) {
		return (
			<div className="text-right">
				<button
					type="button"
					onClick={onClick}
					title={title}
					className={cn(cls, "hover:underline")}
				>
					{display}
				</button>
			</div>
		);
	}
	return (
		<div className="text-right">
			<span className={cls} title={title}>
				{display}
			</span>
		</div>
	);
}

function MarketplaceGitSourceLine({
	source,
	syncing,
}: {
	source: MarketplaceSource;
	syncing: boolean;
}) {
	const repoSlug = repoSlugFromGitUrl(source.gitUrl);
	const hasError = source.lastSyncError !== null;
	const paused = !source.enabled;
	const syncState: "syncing" | "error" | "paused" | "ok" | "never" = syncing
		? "syncing"
		: hasError
			? "error"
			: paused
				? "paused"
				: source.lastSyncAt
					? "ok"
					: "never";
	const lastSync = source.lastSyncAt ? formatRelativeShort(source.lastSyncAt) : null;
	const statusText =
		syncState === "syncing"
			? "Syncing now"
			: syncState === "error"
				? "Sync failed"
				: syncState === "paused"
					? lastSync
						? `Paused · last sync ${lastSync}`
						: "Paused"
					: syncState === "ok" && lastSync
						? `Synced ${lastSync}`
						: "Never synced";
	const dotStyle: Record<typeof syncState, { className: string; style?: React.CSSProperties }> = {
		syncing: {
			className: "animate-pulse",
			style: {
				background: "var(--color-accent-2)",
				boxShadow: "0 0 6px color-mix(in srgb, var(--color-accent-2) 70%, transparent)",
			},
		},
		error: {
			className: "",
			style: { background: "var(--color-danger)" },
		},
		paused: {
			className: "",
			style: { background: "var(--color-text-4)" },
		},
		ok: {
			className: "",
			style: {
				background: "var(--color-success)",
				boxShadow: "0 0 4px color-mix(in srgb, var(--color-success) 60%, transparent)",
			},
		},
		never: {
			className: "",
			style: { background: "var(--color-text-4)" },
		},
	};
	const statusTextColor =
		syncState === "error"
			? "text-danger"
			: syncState === "syncing"
				? "text-accent-2"
				: syncState === "paused" || syncState === "never"
					? "text-text-4"
					: "text-text-3";
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			<a
				href={source.gitUrl}
				target="_blank"
				rel="noreferrer"
				title={source.gitUrl}
				className="inline-flex min-w-0 max-w-full items-center gap-1.5 truncate rounded-md border border-edge-dim bg-surface-700/50 px-2 py-[3px] font-mono text-[11px] text-text-2 transition-colors hover:border-accent-2/40 hover:bg-accent-2/[0.08] hover:text-text-1"
			>
				<svg
					width="11"
					height="11"
					viewBox="0 0 16 16"
					aria-hidden="true"
					className="shrink-0 text-text-3"
				>
					<path
						fill="currentColor"
						d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
					/>
				</svg>
				<span className="truncate">{repoSlug}</span>
				<ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />
			</a>
			<span
				className="inline-flex items-center gap-1 rounded border border-edge-dim bg-surface-800 px-1.5 py-[1px] font-mono text-[10px] text-text-3"
				title={`Branch · ${source.branch || "main"}`}
			>
				<GitBranch className="h-2.5 w-2.5" aria-hidden="true" />
				{source.branch || "main"}
			</span>
			<span
				className={cn(
					"inline-flex items-center gap-1.5 font-mono text-[10.5px]",
					statusTextColor,
				)}
			>
				<span
					aria-hidden="true"
					className={cn("inline-block h-1.5 w-1.5 rounded-full", dotStyle[syncState].className)}
					style={dotStyle[syncState].style}
				/>
				{statusText}
			</span>
		</div>
	);
}

function MarketplaceAdoptionCell({
	activated,
	total,
}: {
	activated: number;
	total: number;
}) {
	if (total === 0) {
		return (
			<div>
				<span className="font-mono text-[11px] text-text-4">—</span>
			</div>
		);
	}
	const clampedActivated = Math.min(activated, total);
	const pct = (clampedActivated / total) * 100;
	const color =
		pct >= 66 ? "var(--color-success)" : pct >= 33 ? "var(--color-warning)" : "var(--color-danger)";
	return (
		<div
			className="flex min-w-0 flex-col gap-1 pr-3"
			title={`${clampedActivated} of ${total} skills used at least once`}
		>
			<div
				className="h-1.5 overflow-hidden rounded-[3px]"
				style={{
					background: "color-mix(in srgb, var(--color-surface-700) 70%, transparent)",
				}}
			>
				<div
					className="h-full rounded-[3px] transition-[width] duration-200 ease-out"
					style={{ width: `${pct}%`, background: color }}
				/>
			</div>
			<div className="flex items-baseline justify-between font-mono tabular-nums">
				<span className="text-[12px] text-text-1">{Math.round(pct)}%</span>
				<span className="text-[10px] text-text-4">
					{clampedActivated}/{total}
				</span>
			</div>
		</div>
	);
}

interface SourceForm {
	gitUrl: string;
	accessToken: string;
	branch: string;
	syncIntervalSecs: string;
	enabled: boolean;
	importPluginsAndSkills: boolean;
}

const defaultSourceForm: SourceForm = {
	gitUrl: "",
	accessToken: "",
	branch: "",
	syncIntervalSecs: "3600",
	enabled: true,
	importPluginsAndSkills: false,
};

export default function MarketplacesPage() {
	const [items, setItems] = useState<Marketplace[]>([]);
	const [sources, setSources] = useState<MarketplaceSource[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
	const [drawerInitialMode, setDrawerInitialMode] = useState<"view" | "edit">("view");
	const [importForMarketplace, setImportForMarketplace] = useState<string | null>(null);
	const [searchParams, setSearchParams] = useSearchParams();

	const { refresh: refreshSourcesHealth } = useMarketplaceSourcesHealth();

	const statusFilterParam = searchParams.get("status");
	const statusFilter: "all" | MarketplaceStatus =
		statusFilterParam === "to_review" ||
		statusFilterParam === "approved" ||
		statusFilterParam === "denied" ||
		statusFilterParam === "ignored"
			? statusFilterParam
			: "all";
	const { includeIgnored, setIncludeIgnored } = useIncludeIgnored();
	function setStatusFilter(next: "all" | MarketplaceStatus) {
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (next === "all") params.delete("status");
				else params.set("status", next);
				return params;
			},
			{ replace: true },
		);
	}
	const search = searchParams.get("search") ?? "";
	const highlightName = searchParams.get("name") ?? "";
	const highlightedRowRef = useRef<HTMLDivElement | null>(null);

	function clearParam(key: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.delete(key);
				return next;
			},
			{ replace: true },
		);
	}

	function updateSearch(value: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (!value) next.delete("search");
				else next.set("search", value);
				return next;
			},
			{ replace: true },
		);
	}

	const [showSourceForm, setShowSourceForm] = useState(false);
	const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
	const [sourceForm, setSourceForm] = useState<SourceForm>(defaultSourceForm);
	const [savingSource, setSavingSource] = useState(false);
	const [syncingSourceIds, setSyncingSourceIds] = useState<Set<string>>(() => new Set());
	const [resumingSourceIds, setResumingSourceIds] = useState<Set<string>>(() => new Set());
	const [testingConnection, setTestingConnection] = useState(false);
	const [connectionTestResult, setConnectionTestResult] = useState<
		| { ok: true; name: string; pluginCount: number; skillCount: number }
		| { ok: false; error: string }
		| null
	>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<{
		name: string;
		cascade: boolean;
		withSources: boolean;
	} | null>(null);
	const [deletingMarketplace, setDeletingMarketplace] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	useEffect(() => {
		Promise.all([
			api.marketplaces.list({ includeIgnored }).then((res) => setItems(res.marketplaces)),
			api.marketplaceSources.list().then(setSources),
		])
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, [includeIgnored]);

	async function handleStatusChange(name: string, status: MarketplaceStatus) {
		setItems((prev) => prev.map((m) => (m.name === name ? { ...m, status } : m)));
		try {
			await api.marketplaces.update(name, { status });
		} catch {
			api.marketplaces
				.list({ includeIgnored })
				.then((res) => setItems(res.marketplaces))
				.catch(() => {});
		}
	}

	function openMarketplaceDrawer(name: string, mode: "view" | "edit" = "view") {
		setDrawerInitialMode(mode);
		setSelectedMarketplace(name);
	}

	function closeMarketplaceDrawer() {
		setSelectedMarketplace(null);
		setImportForMarketplace(null);
	}

	async function refreshMarketplaceData() {
		const [mpRes, srcRes] = await Promise.all([
			api.marketplaces.list({ includeIgnored }),
			api.marketplaceSources.list(),
		]);
		setItems(mpRes.marketplaces);
		setSources(srcRes);
		refreshSourcesHealth();
	}

	function openCreateSource(forMarketplace: string | null = null) {
		setEditingSourceId(null);
		setSourceForm(defaultSourceForm);
		setConnectionTestResult(null);
		setSubmitError(null);
		setImportForMarketplace(forMarketplace);
		setShowSourceForm(true);
	}

	function handleRequestImport(marketplaceName: string) {
		setSelectedMarketplace(null);
		openCreateSource(marketplaceName);
	}

	function closeSourceForm() {
		setShowSourceForm(false);
		setEditingSourceId(null);
		setImportForMarketplace(null);
	}

	function updateSourceField<K extends keyof SourceForm>(key: K, value: SourceForm[K]) {
		setSourceForm((f) => ({ ...f, [key]: value }));
		if (key === "gitUrl" || key === "accessToken" || key === "branch") {
			setConnectionTestResult(null);
			setSubmitError(null);
		}
	}

	async function handleTestConnection() {
		setTestingConnection(true);
		setConnectionTestResult(null);
		try {
			const result = await api.marketplaceSources.testConnection({
				gitUrl: sourceForm.gitUrl.trim(),
				accessToken: sourceForm.accessToken || null,
				branch: sourceForm.branch.trim() || null,
				sourceId: editingSourceId,
			});
			setConnectionTestResult(result);
		} catch (e) {
			setConnectionTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
		} finally {
			setTestingConnection(false);
		}
	}

	function extractErrorMessage(e: unknown): string {
		const raw = e instanceof Error ? e.message : String(e);
		try {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed.error === "string") {
				if (Array.isArray(parsed.sourceIds) && parsed.sourceIds.length > 0) {
					return `${parsed.error} (source IDs: ${parsed.sourceIds.join(", ")})`;
				}
				return parsed.error;
			}
		} catch {}
		return raw;
	}

	function openDeleteMarketplace(name: string) {
		setDeleteError(null);
		setDeleteConfirm({ name, cascade: false, withSources: false });
	}

	function closeDeleteMarketplace() {
		if (deletingMarketplace) return;
		setDeleteConfirm(null);
		setDeleteError(null);
	}

	async function confirmDeleteMarketplace() {
		if (!deleteConfirm) return;
		const { name, cascade, withSources } = deleteConfirm;
		setDeletingMarketplace(true);
		setDeleteError(null);
		try {
			await api.marketplaces.remove(name, {
				mode: cascade ? "cascade" : "orphan",
				withSources,
			});
			const [mpRes, srcRes] = await Promise.all([
				api.marketplaces.list({ includeIgnored }),
				api.marketplaceSources.list(),
			]);
			setItems(mpRes.marketplaces);
			setSources(srcRes);
			refreshSourcesHealth();
			setDeleteConfirm(null);
		} catch (e) {
			setDeleteError(extractErrorMessage(e));
		} finally {
			setDeletingMarketplace(false);
		}
	}

	async function handleSourceSubmit(e: FormEvent) {
		e.preventDefault();
		setSavingSource(true);
		setSubmitError(null);
		try {
			const payload = {
				gitUrl: sourceForm.gitUrl.trim(),
				accessToken: sourceForm.accessToken || null,
				branch: sourceForm.branch.trim() || null,
				syncIntervalMs: Number(sourceForm.syncIntervalSecs) * 1000,
				enabled: sourceForm.enabled,
				importPluginsAndSkills: sourceForm.importPluginsAndSkills,
			};
			if (editingSourceId) {
				const updated = await api.marketplaceSources.update(editingSourceId, payload);
				setSources((prev) => prev.map((s) => (s.id === editingSourceId ? updated : s)));
			} else {
				const { firstSync, ...created } = await api.marketplaceSources.create(payload);
				setSources((prev) => [created, ...prev]);
				if (firstSync?.error) {
					setSubmitError(firstSync.error);
					setSavingSource(false);
					return;
				}
			}
			closeSourceForm();
			await refreshMarketplaceData();
		} catch (e) {
			setSubmitError(extractErrorMessage(e));
		} finally {
			setSavingSource(false);
		}
	}

	async function handleSyncSource(id: string) {
		setSyncingSourceIds((prev) => new Set(prev).add(id));
		try {
			await api.marketplaceSources.syncNow(id);
			await Promise.all([
				api.marketplaces.list({ includeIgnored }).then((res) => setItems(res.marketplaces)),
				api.marketplaceSources.list().then(setSources),
			]);
			refreshSourcesHealth();
		} finally {
			setSyncingSourceIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
		}
	}

	async function handleResumeSource(id: string) {
		setResumingSourceIds((prev) => new Set(prev).add(id));
		try {
			const updated = await api.marketplaceSources.resume(id);
			setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));
			refreshSourcesHealth();
		} finally {
			setResumingSourceIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
		}
	}

	async function handleSyncMarketplace(marketplaceSources: MarketplaceSource[]) {
		await Promise.allSettled(
			marketplaceSources.filter((s) => s.enabled).map((s) => handleSyncSource(s.id)),
		);
	}

	async function handleResumeMarketplace(marketplaceSources: MarketplaceSource[]) {
		await Promise.allSettled(
			marketplaceSources.filter((s) => !s.enabled).map((s) => handleResumeSource(s.id)),
		);
	}

	const filteredItems = useMemo(() => {
		return items.filter((m) => {
			if (statusFilter !== "all" && m.status !== statusFilter) return false;
			if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		});
	}, [items, statusFilter, search]);

	const marketplacesWithImportingSource = useMemo(() => {
		const names = new Set<string>();
		for (const s of sources) {
			if (s.marketplaceName && s.gitUrl && s.importPluginsAndSkills) {
				names.add(s.marketplaceName);
			}
		}
		return names;
	}, [sources]);

	const sourcesByMarketplace = useMemo(() => {
		const map = new Map<string, MarketplaceSource[]>();
		for (const s of sources) {
			if (!s.marketplaceName) continue;
			const arr = map.get(s.marketplaceName) ?? [];
			arr.push(s);
			map.set(s.marketplaceName, arr);
		}
		return map;
	}, [sources]);

	const orphanedSources = useMemo(
		() => sources.filter((s) => !s.marketplaceName),
		[sources],
	);

	useLayoutEffect(() => {
		if (!highlightName || loading) return;
		const node = highlightedRowRef.current;
		if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [highlightName, loading]);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Marketplaces"
				subtitle="Discovered marketplaces and imported git sources. Review and approve each source."
				actions={<Button onClick={() => openCreateSource()}>Import from git</Button>}
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			{showSourceForm && (
				<Card surface="raised">
					<h3 className="text-sm font-medium text-text-1 mb-3">
						{editingSourceId ? "Edit git source" : "Import marketplace from git"}
					</h3>
					{!editingSourceId && importForMarketplace && (
						<p className="mb-3 text-xs text-text-3">
							This source will link to{" "}
							<span className="font-mono text-text-2">{importForMarketplace}</span> if its{" "}
							<span className="font-mono">marketplace.json</span> declares this name.
						</p>
					)}
					<form onSubmit={handleSourceSubmit} className="space-y-5">
						<FormField
							label="Repository URL"
							htmlFor="ms-url"
							required
							helper="Accepts GitHub shorthand (owner/repo) or full GitHub / GitLab / Bitbucket HTTPS URLs."
						>
							<Input
								id="ms-url"
								required
								size="sm"
								value={sourceForm.gitUrl}
								onChange={(e) => updateSourceField("gitUrl", e.target.value)}
								placeholder="owner/repo  or  https://github.com/owner/repo"
							/>
						</FormField>

						<div className="grid grid-cols-2 gap-3">
							<FormField label="Branch" htmlFor="ms-branch">
								<Input
									id="ms-branch"
									size="sm"
									value={sourceForm.branch}
									onChange={(e) => updateSourceField("branch", e.target.value)}
									placeholder="main"
								/>
							</FormField>
							<FormField label="Sync interval (seconds, min 60)" htmlFor="ms-interval">
								<Input
									id="ms-interval"
									type="number"
									min="60"
									size="sm"
									value={sourceForm.syncIntervalSecs}
									onChange={(e) =>
										setSourceForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))
									}
								/>
							</FormField>
						</div>

						<FormField
							label={`Access token${editingSourceId ? " (blank = keep existing)" : ""}`}
							htmlFor="ms-token"
							helper="Leave blank for public repositories."
						>
							<Input
								id="ms-token"
								type="password"
								size="sm"
								value={sourceForm.accessToken}
								onChange={(e) => updateSourceField("accessToken", e.target.value)}
								placeholder={editingSourceId ? "••••••" : ""}
								autoComplete="new-password"
							/>
						</FormField>

						<div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
							<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
								<input
									type="checkbox"
									className="h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
									checked={sourceForm.enabled}
									onChange={(e) => setSourceForm((f) => ({ ...f, enabled: e.target.checked }))}
								/>
								Enable periodic sync
							</label>
							<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
								<input
									type="checkbox"
									className="h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
									checked={sourceForm.importPluginsAndSkills}
									onChange={(e) =>
										setSourceForm((f) => ({ ...f, importPluginsAndSkills: e.target.checked }))
									}
								/>
								Import plugins and skills into registry
							</label>
						</div>

						{connectionTestResult &&
							(connectionTestResult.ok ? (
								<p className="text-xs text-success">
									Connected — found {connectionTestResult.pluginCount} plugin
									{connectionTestResult.pluginCount === 1 ? "" : "s"} and{" "}
									{connectionTestResult.skillCount} skill
									{connectionTestResult.skillCount === 1 ? "" : "s"} in “
									{connectionTestResult.name}”.
								</p>
							) : (
								<p className="text-xs text-danger">{connectionTestResult.error}</p>
							))}

						{submitError && <p className="text-xs text-danger">{submitError}</p>}

						<div className="flex items-center justify-between gap-2 border-t border-edge-dim pt-4">
							<Button
								variant="secondary"
								size="sm"
								onClick={handleTestConnection}
								disabled={!sourceForm.gitUrl.trim()}
								loading={testingConnection}
							>
								Test connection
							</Button>
							<div className="flex items-center gap-2">
								<Button variant="secondary" size="sm" onClick={closeSourceForm}>
									Cancel
								</Button>
								<Button type="submit" size="sm" loading={savingSource}>
									{editingSourceId ? "Update" : "Import"}
								</Button>
							</div>
						</div>
					</form>
				</Card>
			)}

			{orphanedSources.length > 0 && (
				<Card className="border-warning/30 bg-warning/[0.04]" padding="sm">
					<div className="flex items-start gap-2">
						<span
							aria-hidden="true"
							className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
							style={{
								background: "var(--color-warning)",
								boxShadow: "0 0 6px var(--color-warning)",
							}}
						/>
						<div className="min-w-0 text-xs text-text-2">
							<p className="font-medium text-text-1">
								{orphanedSources.length} git source
								{orphanedSources.length === 1 ? "" : "s"} not yet linked to a marketplace
							</p>
							<ul className="mt-1 space-y-0.5">
								{orphanedSources.map((s) => (
									<li key={s.id} className="font-mono text-text-3 truncate" title={s.gitUrl}>
										{s.gitUrl}
										{s.lastSyncError && (
											<span className="ml-2 text-danger">— {s.lastSyncError}</span>
										)}
									</li>
								))}
							</ul>
						</div>
					</div>
				</Card>
			)}

			<div className="space-y-3">
				{items.length > 0 && (
					<div className="flex flex-wrap items-center gap-3">
						<Input
							size="sm"
							placeholder="Search marketplace name or description…"
							value={search}
							onChange={(e) => updateSearch(e.target.value)}
							className="min-w-64 max-w-md flex-1"
						/>
						<div
							role="tablist"
							aria-label="Filter by status"
							className="inline-flex gap-0.5 rounded-lg border border-edge-dim bg-surface-800 p-[2px]"
						>
							{MP_FILTER_OPTIONS.map((opt) => {
								const count =
									opt.key === "all"
										? items.length
										: items.filter((m) => m.status === opt.key).length;
								const active = statusFilter === opt.key;
								return (
									<button
										key={opt.key}
										type="button"
										role="tab"
										aria-selected={active}
										onClick={() => setStatusFilter(opt.key)}
										className={cn(
											"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
											active
												? "bg-surface-700 text-text-1 shadow-[inset_0_0_0_1px_var(--color-edge)]"
												: "text-text-3 hover:text-text-1",
										)}
									>
										{opt.dot && (
											<span
												aria-hidden="true"
												className="h-1.5 w-1.5 rounded-full"
												style={{ background: opt.dot, boxShadow: `0 0 4px ${opt.dot}` }}
											/>
										)}
										{opt.label}
										<span
											className={cn(
												"font-mono text-[10px]",
												active ? "text-text-2" : "text-text-4",
											)}
										>
											{count}
										</span>
									</button>
								);
							})}
						</div>
						{highlightName && (
							<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
								Highlighted: {highlightName}
								<button
									type="button"
									aria-label="Clear highlight"
									onClick={() => clearParam("name")}
									className="text-text-4 hover:text-text-1"
								>
									×
								</button>
							</span>
						)}
						<IncludeIgnoredToggle value={includeIgnored} onChange={setIncludeIgnored} />
						<span className="ml-auto font-mono text-xs text-text-4">
							{filteredItems.length} <span className="text-text-4">/ {items.length}</span>
						</span>
					</div>
				)}

				{items.length === 0 ? (
					<Card padding="lg" className="flex flex-col items-center gap-3 text-center py-12">
						<div className="w-12 h-12 rounded-full bg-surface-800 border border-edge flex items-center justify-center">
							<svg
								className="w-6 h-6 text-text-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
								role="img"
								aria-label="No marketplaces"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
								/>
							</svg>
						</div>
						<div>
							<p className="text-sm font-medium text-text-2">No marketplaces yet</p>
							<p className="text-xs text-text-4 mt-1">
								Import a git repository above, or marketplaces appear automatically when skills are
								activated.
							</p>
						</div>
					</Card>
				) : (
					<div className="overflow-x-auto">
						<div className="min-w-[1120px] rounded-lg border border-edge bg-surface-900">
							<div
								className={cn(
									"grid items-center gap-3 border-b border-edge px-4 h-9 font-mono text-[10px] uppercase tracking-wider text-text-4",
									"bg-gradient-to-b from-accent-bright/[0.04] to-transparent",
									MP_GRID_COLS,
								)}
							>
								<div>Source</div>
								<div className="text-right">Plugins</div>
								<div className="text-right">Skills</div>
								<div>Adoption</div>
								<div className="text-right">Installs</div>
								<div className="text-right">Linked</div>
								<div className="text-right">Acts</div>
								<div className="text-right">Acts · 30d</div>
								<div className="text-right">Status</div>
								<div />
							</div>

							{filteredItems.length === 0 && (
								<div className="px-7 py-7 text-center font-mono text-xs text-text-4">
									{statusFilter === "ignored" && !includeIgnored
										? "Ignored marketplaces are hidden. Enable 'Include ignored' to view them."
										: "No marketplaces match the current filters."}
								</div>
							)}

							{filteredItems.map((mp) => {
								const isHighlighted = highlightName === mp.name;
								const mpSources = sourcesByMarketplace.get(mp.name) ?? [];
								const hasGit = mpSources.length > 0;
								const anyEnabled = mpSources.some((s) => s.enabled);
								const anySyncing = mpSources.some((s) => syncingSourceIds.has(s.id));
								const anyResuming = mpSources.some((s) => resumingSourceIds.has(s.id));
								const errorSource = mpSources.find((s) => s.lastSyncError !== null);
								return (
									<div
										key={mp.name}
										ref={isHighlighted ? highlightedRowRef : undefined}
										className={cn(
											"grid items-start gap-3 border-t border-edge-dim px-4 py-3.5 transition-colors first:border-t-0 hover:bg-accent-bright/[0.03]",
											isHighlighted &&
												"bg-accent-bright/[0.06] ring-1 ring-inset ring-accent-bright/40",
											MP_GRID_COLS,
										)}
									>
										<div className="flex min-w-0 items-start gap-3">
											<MarketplaceLogo name={mp.name} size="lg" />
											<div className="min-w-0 flex-1">
												<div className="flex min-w-0 items-center gap-2">
													<button
														type="button"
														onClick={() => openMarketplaceDrawer(mp.name)}
														className="truncate font-mono text-sm text-text-1 hover:underline"
														title={mp.name}
													>
														{mp.name}
													</button>
												</div>
												{mp.description && (
													<div
														className="mt-0.5 truncate text-xs text-text-3"
														title={mp.description}
													>
														{mp.description}
													</div>
												)}
												{hasGit ? (
													<div className="mt-2 flex flex-col gap-1.5">
														{mpSources.map((source) => (
															<MarketplaceGitSourceLine
																key={source.id}
																source={source}
																syncing={syncingSourceIds.has(source.id)}
															/>
														))}
													</div>
												) : (
													<button
														type="button"
														onClick={() => openCreateSource(mp.name)}
														className="mt-2 inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border border-dashed border-edge bg-transparent px-2 py-[3px] font-mono text-[11px] text-text-4 transition-colors hover:border-accent-bright/40 hover:bg-accent-bright/[0.04] hover:text-text-2"
														title="Connect a git repository to this marketplace"
													>
														<Link2Off className="h-3 w-3" aria-hidden="true" />
														<span>Not connected to a repo</span>
														<span className="ml-1 inline-flex items-center rounded border border-accent-bright/35 bg-accent-bright/[0.18] px-1.5 py-px text-[10px] text-accent-bright">
															Connect repo
														</span>
													</button>
												)}
											</div>
										</div>

										<MarketplaceNumCell
											value={mp.pluginCount}
											onClick={() => openMarketplaceDrawer(mp.name)}
											title="View marketplace plugins"
										/>
										<MarketplaceNumCell
											value={mp.knownSkillCount}
											onClick={() => openMarketplaceDrawer(mp.name)}
											title="View marketplace skills"
										/>
										{(() => {
											const adoptionAvailable =
												marketplacesWithImportingSource.has(mp.name) && mp.knownSkillCount > 0;
											if (!adoptionAvailable) {
												return (
													<div>
														<span
															className="font-mono text-[11px] text-text-4"
															title="Adoption is only computed when a git source is configured with plugin/skill import enabled."
														>
															—
														</span>
													</div>
												);
											}
											return (
												<button
													type="button"
													onClick={() => openMarketplaceDrawer(mp.name)}
													className="text-left transition-opacity hover:opacity-80"
													title={
														mp.activatedSkillCount === 0
															? "No skill activated yet — click to inspect"
															: "View activated skills"
													}
												>
													<MarketplaceAdoptionCell
														activated={mp.activatedSkillCount}
														total={mp.knownSkillCount}
													/>
												</button>
											);
										})()}
										<MarketplaceNumCell
											value={mp.pluginInstallCount}
											href={
												mp.pluginInstallCount > 0
													? `/plugins?marketplace=${encodeURIComponent(mp.name)}`
													: undefined
											}
										/>
										<MarketplaceNumCell value={mp.skillActivatedLinkedCount} />
										<MarketplaceNumCell value={mp.totalActivationCount} />
										<MarketplaceNumCell value={mp.activationCount} />

										<div className="flex justify-end pt-0.5">
											<StatusChip
												value={mp.status}
												options={MARKETPLACE_STATUS_CHIP_OPTIONS}
												onChange={(v) => handleStatusChange(mp.name, v)}
												ariaLabel={`Status for ${mp.name}`}
											/>
										</div>

										<div className="flex items-center justify-end gap-1 pt-0.5">
											{hasGit && (anyEnabled ? (
												<button
													type="button"
													aria-label={`Sync ${mp.name}`}
													title={anySyncing ? "Syncing…" : "Sync now"}
													disabled={anySyncing}
													onClick={() => handleSyncMarketplace(mpSources)}
													className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-text-3 transition-colors hover:border-accent-bright/40 hover:bg-accent-bright/[0.08] hover:text-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
												>
													{anySyncing ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
													) : (
														<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
													)}
												</button>
											) : (
												<button
													type="button"
													aria-label={`Resume sync for ${mp.name}`}
													title={anyResuming ? "Resuming…" : "Resume sync"}
													disabled={anyResuming}
													onClick={() => handleResumeMarketplace(mpSources)}
													className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-60"
												>
													{anyResuming ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
													) : (
														<Play className="h-3.5 w-3.5" aria-hidden="true" />
													)}
												</button>
											))}
											<button
												type="button"
												aria-label={`Edit ${mp.name}`}
												title="Edit"
												onClick={() => openMarketplaceDrawer(mp.name, "edit")}
												className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-text-3 transition-colors hover:border-edge hover:bg-surface-700 hover:text-text-1"
											>
												<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
											</button>
											<button
												type="button"
												aria-label={`Delete ${mp.name}`}
												title="Delete"
												onClick={() => openDeleteMarketplace(mp.name)}
												className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-text-3 transition-colors hover:border-danger/35 hover:bg-surface-700 hover:text-danger"
											>
												<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
											</button>
										</div>
										{errorSource?.lastSyncError && (
											<div className="col-span-full -mx-4 -mb-3.5 pb-3 pt-1">
												<SourceErrorBanner message={errorSource.lastSyncError} />
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>

			<MarketplaceDetailsDrawer
				marketplace={
					selectedMarketplace ? (items.find((m) => m.name === selectedMarketplace) ?? null) : null
				}
				linkedSources={
					selectedMarketplace
						? sources.filter((s) => s.marketplaceName === selectedMarketplace)
						: []
				}
				initialMode={drawerInitialMode}
				onClose={closeMarketplaceDrawer}
				onChanged={refreshMarketplaceData}
				onRequestImport={handleRequestImport}
			/>

			{deleteConfirm &&
				(() => {
					const linkedSources = sources.filter((s) => s.marketplaceName === deleteConfirm.name);
					return (
						<div className="fixed inset-0 z-50 flex items-center justify-center">
							<button
								type="button"
								aria-label="Close"
								onClick={closeDeleteMarketplace}
								className="absolute inset-0 bg-black/50 backdrop-blur-sm"
							/>
							<dialog
								open
								aria-modal="true"
								aria-label={`Delete marketplace ${deleteConfirm.name}`}
								className="relative m-0 w-[440px] max-w-[92vw] rounded-md border border-edge bg-surface-900 p-5 text-text-1 shadow-2xl"
							>
								<h2 className="text-sm font-semibold text-text-1">
									Delete <span className="font-mono">{deleteConfirm.name}</span>?
								</h2>
								<p className="mt-2 text-xs text-text-3">This marketplace will be removed.</p>
								<label className="mt-4 flex items-start gap-2 text-sm text-text-2 cursor-pointer">
									<input
										type="checkbox"
										className="mt-0.5 h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
										checked={deleteConfirm.cascade}
										onChange={(e) =>
											setDeleteConfirm((prev) =>
												prev ? { ...prev, cascade: e.target.checked } : prev,
											)
										}
										disabled={deletingMarketplace}
									/>
									<span>
										Also delete linked plugins and skills
										<span className="block mt-1 text-xs text-text-4">
											Off: plugins from this marketplace are kept as orphaned “removed” entries;
											their history stays intact. On: plugins, plugin-skill links, and skill records
											tied to those plugins are permanently deleted.
										</span>
									</span>
								</label>
								{linkedSources.length > 0 && (
									<label className="mt-3 flex items-start gap-2 text-sm text-text-2 cursor-pointer">
										<input
											type="checkbox"
											className="mt-0.5 h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
											checked={deleteConfirm.withSources}
											onChange={(e) =>
												setDeleteConfirm((prev) =>
													prev ? { ...prev, withSources: e.target.checked } : prev,
												)
											}
											disabled={deletingMarketplace}
										/>
										<span>
											Also delete {linkedSources.length} linked git source
											{linkedSources.length === 1 ? "" : "s"}
											<span className="mt-1 block text-xs text-text-4">
												{deleteConfirm.withSources ? (
													<>
														These git sources will be removed and their schedulers stopped:
														<ul className="mt-1 list-disc pl-4 font-mono">
															{linkedSources.map((s) => (
																<li key={s.id} className="truncate" title={s.gitUrl}>
																	{s.gitUrl}
																</li>
															))}
														</ul>
													</>
												) : (
													<>
														If left off, the marketplace cannot be deleted while these sources still
														reference it.
													</>
												)}
											</span>
										</span>
									</label>
								)}
								{deleteError && <p className="mt-3 text-xs text-danger">{deleteError}</p>}
								<div className="mt-5 flex items-center justify-end gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={closeDeleteMarketplace}
										disabled={deletingMarketplace}
									>
										Cancel
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={confirmDeleteMarketplace}
										loading={deletingMarketplace}
										className="text-danger hover:text-danger"
									>
										Delete
									</Button>
								</div>
							</dialog>
						</div>
					);
				})()}
		</div>
	);
}
