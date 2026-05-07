import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Token } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

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

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold text-gray-900">Ingestion Tokens</h1>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Create token
				</button>
			</div>

			{expiringSoon.length > 0 && (
				<div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
					{expiringSoon.length} token{expiringSoon.length > 1 ? "s" : ""} expiring within 7 days:{" "}
					{expiringSoon.map((t) => t.name).join(", ")}
				</div>
			)}

			{newJwt && (
				<div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
					<p className="text-sm font-medium text-green-800">
						Token created — copy it now, it won't be shown again.
					</p>
					<div className="flex gap-2">
						<input
							readOnly
							value={newJwt}
							className="flex-1 rounded border border-green-300 bg-white px-3 py-1.5 text-xs font-mono text-gray-700"
						/>
						<button
							type="button"
							onClick={copyJwt}
							className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800"
						>
							{jwtCopied ? "Copied!" : "Copy"}
						</button>
						<button
							type="button"
							onClick={() => setNewJwt(null)}
							className="text-xs text-gray-400 hover:text-gray-600"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{showCreate && (
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-900 mb-3">New token</h2>
					<form onSubmit={handleCreate} className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="token-name" className="block text-xs text-gray-500 mb-1">
									Name *
								</label>
								<input
									id="token-name"
									required
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
								/>
							</div>
							<div>
								<label htmlFor="token-user-label" className="block text-xs text-gray-500 mb-1">
									User / Team label
								</label>
								<input
									id="token-user-label"
									value={form.userLabel}
									onChange={(e) => setForm((f) => ({ ...f, userLabel: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
								/>
							</div>
						</div>
						<div>
							<label htmlFor="token-expires-at" className="block text-xs text-gray-500 mb-1">
								Expires at (leave blank = no expiry)
							</label>
							<input
								id="token-expires-at"
								type="datetime-local"
								value={form.expiresAt}
								onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
								className="rounded border border-gray-300 px-3 py-1.5 text-sm"
							/>
						</div>
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={creating}
								className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
							>
								{creating ? "Creating…" : "Create"}
							</button>
							<button
								type="button"
								onClick={() => setShowCreate(false)}
								className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-gray-50 border-b border-gray-200">
						<tr>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
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
							const statusColor = {
								active: "bg-green-100 text-green-700",
								expiring: "bg-amber-100 text-amber-700",
								expired: "bg-gray-100 text-gray-500",
								revoked: "bg-red-100 text-red-600",
							}[status];

							return (
								<tr
									key={token.id}
									className={`border-b border-gray-100 ${isRevoked ? "opacity-50" : ""}`}
								>
									<td className="px-4 py-3 font-medium text-gray-900">{token.name}</td>
									<td className="px-4 py-3 text-gray-500">{token.userLabel ?? "—"}</td>
									<td className="px-4 py-3 text-gray-500">{formatDateTime(token.createdAt)}</td>
									<td className="px-4 py-3 text-gray-500">
										{token.expiresAt ? formatDate(token.expiresAt) : "Never"}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
										>
											{status}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										{!isRevoked && !isExpired && (
											<button
												type="button"
												onClick={() => handleRevoke(token.id)}
												className="text-xs text-red-600 hover:text-red-800"
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
								<td colSpan={6} className="px-4 py-6 text-center text-gray-400">
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
