import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Token } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

// Badge classes use semantic utilities from index.css
const STATUS_BADGE: Record<string, string> = {
	active:   "badge badge-success",
	expiring: "badge badge-warning",
	expired:  "badge badge-neutral",
	revoked:  "badge badge-danger",
};

export default function TokensPage() {
	const [tokens, setTokens] = useState<Token[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [newJwt, setNewJwt] = useState<string | null>(null);
	const [jwtCopied, setJwtCopied] = useState(false);
	const [form, setForm] = useState({ name: "", userLabel: "", expiresAt: "" });
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		api.tokens
			.list()
			.then(setTokens)
			.finally(() => setLoading(false));
	}, []);

	const expiringSoon = tokens.filter((t) => t.expiresSoon && !t.revokedAt);

	async function handleCreate(e: FormEvent) {
		e.preventDefault();
		setCreating(true);
		try {
			const created = await api.tokens.create({
				name: form.name,
				userLabel: form.userLabel || undefined,
				expiresAt: form.expiresAt || undefined,
			});
			const { jwt, ...token } = created;
			setTokens((t) => [token, ...t]);
			setNewJwt(jwt);
			setShowCreate(false);
			setForm({ name: "", userLabel: "", expiresAt: "" });
		} finally {
			setCreating(false);
		}
	}

	async function handleRevoke(id: string) {
		await api.tokens.revoke(id);
		setTokens((t) =>
			t.map((tok) => (tok.id === id ? { ...tok, revokedAt: new Date().toISOString() } : tok)),
		);
	}

	async function copyJwt() {
		if (!newJwt) return;
		await navigator.clipboard.writeText(newJwt);
		setJwtCopied(true);
		setTimeout(() => setJwtCopied(false), 2000);
	}

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold text-text-1">Ingestion Tokens</h1>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					Create token
				</button>
			</div>

			{expiringSoon.length > 0 && (
				<div className="bg-warning/10 border border-warning/25 rounded-lg px-4 py-3 text-sm text-warning">
					{expiringSoon.length} token{expiringSoon.length > 1 ? "s" : ""} expiring within 7 days:{" "}
					{expiringSoon.map((t) => t.name).join(", ")}
				</div>
			)}

			{newJwt && (
				<div className="bg-success/10 border border-success/25 rounded-lg p-4 space-y-2">
					<p className="text-sm font-medium text-success">
						Token created — copy it now, it won't be shown again.
					</p>
					<div className="flex gap-2">
						<input
							readOnly
							value={newJwt}
							className="flex-1 rounded border border-edge bg-surface-800 px-3 py-1.5 text-xs font-mono text-text-2"
						/>
						<button
							type="button"
							onClick={copyJwt}
							className="text-xs bg-success/20 text-success border border-success/30 px-3 py-1 rounded hover:bg-success/30 transition-colors"
						>
							{jwtCopied ? "Copied!" : "Copy"}
						</button>
						<button
							type="button"
							onClick={() => setNewJwt(null)}
							className="text-xs text-text-3 hover:text-text-1 transition-colors"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{showCreate && (
				<div className="bg-surface-700 rounded-lg border border-edge p-4">
					<h2 className="text-sm font-medium text-text-1 mb-3">New token</h2>
					<form onSubmit={handleCreate} className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="token-name" className="block text-xs text-text-3 mb-1">
									Name *
								</label>
								<input
									id="token-name"
									required
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
									className="w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent-bright"
								/>
							</div>
							<div>
								<label htmlFor="token-user-label" className="block text-xs text-text-3 mb-1">
									User / Team label
								</label>
								<input
									id="token-user-label"
									value={form.userLabel}
									onChange={(e) => setForm((f) => ({ ...f, userLabel: e.target.value }))}
									className="w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent-bright"
								/>
							</div>
						</div>
						<div>
							<label htmlFor="token-expires-at" className="block text-xs text-text-3 mb-1">
								Expires at (leave blank = no expiry)
							</label>
							<input
								id="token-expires-at"
								type="datetime-local"
								value={form.expiresAt}
								onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
								className="rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent-bright"
							/>
						</div>
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={creating}
								className="btn-primary rounded px-3 py-1.5 text-sm"
							>
								{creating ? "Creating…" : "Create"}
							</button>
							<button
								type="button"
								onClick={() => setShowCreate(false)}
								className="rounded border border-edge px-3 py-1.5 text-sm text-text-3 hover:bg-surface-800 hover:text-text-1 transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-surface-800 border-b border-edge">
						<tr>
							<th className="text-left px-4 py-3 font-medium text-text-3">Name</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Label</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Created</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Expires</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Status</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{tokens.map((token) => {
							const isRevoked = Boolean(token.revokedAt);
							const isExpired = token.expiresAt ? new Date(token.expiresAt) < new Date() : false;
							const status = isRevoked
								? "revoked"
								: isExpired
									? "expired"
									: token.expiresSoon
										? "expiring"
										: "active";

							return (
								<tr
									key={token.id}
									className={`border-b border-edge-dim transition-colors ${isRevoked ? "opacity-40" : "hover:bg-surface-800"}`}
								>
									<td className="px-4 py-3 font-medium text-text-1">{token.name}</td>
									<td className="px-4 py-3 text-text-3">{token.userLabel ?? "—"}</td>
									<td className="px-4 py-3 text-text-3">{formatDateTime(token.createdAt)}</td>
									<td className="px-4 py-3 text-text-3">
										{token.expiresAt ? formatDate(token.expiresAt) : "Never"}
									</td>
									<td className="px-4 py-3">
										<span className={STATUS_BADGE[status]}>
											{status}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										{!isRevoked && !isExpired && (
											<button
												type="button"
												onClick={() => handleRevoke(token.id)}
												className="text-xs text-danger hover:opacity-80 transition-opacity"
											>
												Revoke
											</button>
										)}
									</td>
								</tr>
							);
						})}
						{tokens.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-6 text-center text-text-4">
									No tokens yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
