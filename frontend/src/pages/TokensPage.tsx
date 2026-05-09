import {
	Button,
	Card,
	EmptyRow,
	FormField,
	Input,
	PageHeader,
	TBody,
	TD,
	TH,
	THead,
	TR,
	Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Token } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

const STATUS_BADGE: Record<string, string> = {
	active: "badge badge-success",
	expiring: "badge badge-warning",
	expired: "badge badge-neutral",
	revoked: "badge badge-danger",
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
			<PageHeader
				title="Ingestion Tokens"
				actions={<Button onClick={() => setShowCreate(true)}>Create token</Button>}
			/>

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
						<Input
							readOnly
							value={newJwt}
							size="sm"
							className="flex-1 font-mono text-xs text-text-2"
						/>
						<Button variant="secondary" size="sm" onClick={copyJwt}>
							{jwtCopied ? "Copied!" : "Copy"}
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setNewJwt(null)}>
							Dismiss
						</Button>
					</div>
				</div>
			)}

			{showCreate && (
				<Card surface="raised">
					<h2 className="text-sm font-medium text-text-1 mb-3">New token</h2>
					<form onSubmit={handleCreate} className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<FormField label="Name" htmlFor="token-name" required>
								<Input
									id="token-name"
									required
									size="sm"
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								/>
							</FormField>
							<FormField label="User / Team label" htmlFor="token-user-label">
								<Input
									id="token-user-label"
									size="sm"
									value={form.userLabel}
									onChange={(e) => setForm((f) => ({ ...f, userLabel: e.target.value }))}
								/>
							</FormField>
						</div>
						<FormField
							label="Expires at"
							htmlFor="token-expires-at"
							helper="Leave blank = no expiry"
						>
							<Input
								id="token-expires-at"
								type="datetime-local"
								size="sm"
								value={form.expiresAt}
								onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
							/>
						</FormField>
						<div className="flex gap-2">
							<Button type="submit" size="sm" loading={creating}>
								Create
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => setShowCreate(false)}
							>
								Cancel
							</Button>
						</div>
					</form>
				</Card>
			)}

			<Table>
				<THead>
					<TR>
						<TH>Name</TH>
						<TH>Label</TH>
						<TH>Created</TH>
						<TH>Expires</TH>
						<TH>Status</TH>
						<TH align="right">{""}</TH>
					</TR>
				</THead>
				<TBody>
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
							<TR key={token.id} className={isRevoked ? "opacity-40" : undefined}>
								<TD className="font-medium">{token.name}</TD>
								<TD className="text-text-3">{token.userLabel ?? "—"}</TD>
								<TD className="text-text-3">{formatDateTime(token.createdAt)}</TD>
								<TD className="text-text-3">
									{token.expiresAt ? formatDate(token.expiresAt) : "Never"}
								</TD>
								<TD>
									<span className={STATUS_BADGE[status]}>{status}</span>
								</TD>
								<TD align="right">
									{!isRevoked && !isExpired && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleRevoke(token.id)}
											className="text-danger hover:text-danger"
										>
											Revoke
										</Button>
									)}
								</TD>
							</TR>
						);
					})}
					{tokens.length === 0 && <EmptyRow colSpan={6}>No tokens yet.</EmptyRow>}
				</TBody>
			</Table>
		</div>
	);
}
