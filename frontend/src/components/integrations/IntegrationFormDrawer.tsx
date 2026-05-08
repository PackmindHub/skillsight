import { Drawer } from "@/components/ui/Drawer";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { Integration, IntegrationPreviewEvent } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

type AuthType = "none" | "basic";

interface FormState {
	name: string;
	url: string;
	authType: AuthType;
	authUsername: string;
	authPassword: string;
	lokiQuery: string;
	syncIntervalSecs: string;
	enabled: boolean;
}

const defaultForm: FormState = {
	name: "",
	url: "",
	authType: "none",
	authUsername: "",
	authPassword: "",
	lokiQuery: '{service_name="claude-code"} | event_name=~`skill_activated|plugin_installed`',
	syncIntervalSecs: "30",
	enabled: true,
};

const inputClass =
	"w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright";

interface IntegrationFormDrawerProps {
	open: boolean;
	editing: Integration | null;
	onClose: () => void;
	onSaved: (integration: Integration, mode: "create" | "update") => void;
}

export function IntegrationFormDrawer({ open, editing, onClose, onSaved }: IntegrationFormDrawerProps) {
	const [form, setForm] = useState<FormState>(defaultForm);
	const [saving, setSaving] = useState(false);
	const [previewEvents, setPreviewEvents] = useState<IntegrationPreviewEvent[] | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (editing) {
			setForm({
				name: editing.name,
				url: editing.url,
				authType: editing.authType,
				authUsername: editing.authUsername ?? "",
				authPassword: "",
				lokiQuery: editing.lokiQuery,
				syncIntervalSecs: String(Math.round(editing.syncIntervalMs / 1000)),
				enabled: editing.enabled,
			});
		} else {
			setForm(defaultForm);
		}
		setPreviewEvents(null);
		setPreviewError(null);
	}, [open, editing]);

	function resetPreview() {
		setPreviewEvents(null);
		setPreviewError(null);
	}

	async function handlePreview() {
		setPreviewing(true);
		setPreviewEvents(null);
		setPreviewError(null);
		try {
			const results = await api.integrations.preview({
				url: form.url,
				authType: form.authType,
				authUsername: form.authType === "basic" ? form.authUsername || null : null,
				authPassword: form.authType === "basic" && form.authPassword ? form.authPassword : null,
				lokiQuery: form.lokiQuery,
				integrationId: editing?.id ?? null,
			});
			setPreviewEvents(results);
		} catch (err) {
			setPreviewError(err instanceof Error ? err.message : "Preview failed");
		} finally {
			setPreviewing(false);
		}
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const payload = {
				name: form.name,
				url: form.url,
				authType: form.authType,
				authUsername: form.authType === "basic" ? form.authUsername || null : null,
				authPassword:
					form.authType === "basic" && form.authPassword ? form.authPassword : null,
				lokiQuery: form.lokiQuery,
				syncIntervalMs: Number(form.syncIntervalSecs) * 1000,
				enabled: form.enabled,
			};

			if (editing) {
				const updated = await api.integrations.update(editing.id, payload);
				onSaved(updated, "update");
			} else {
				const created = await api.integrations.create(payload);
				onSaved(created, "create");
			}
		} finally {
			setSaving(false);
		}
	}

	const formId = "integration-form";

	return (
		<Drawer
			open={open}
			onClose={onClose}
			title={editing ? "Edit integration" : "New integration"}
			footer={
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded border border-edge px-3 py-1.5 text-sm text-text-3 transition-colors hover:bg-surface-800 hover:text-text-1"
					>
						Cancel
					</button>
					<button
						type="submit"
						form={formId}
						disabled={saving}
						className="btn-primary rounded-md px-4 py-1.5 text-sm font-medium"
					>
						{saving ? "Saving…" : editing ? "Update" : "Create"}
					</button>
				</div>
			}
		>
			<form id={formId} onSubmit={handleSubmit} className="space-y-6">
				<section className="space-y-3">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-text-4">
						Connection
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label htmlFor="int-name" className="mb-1 block text-xs text-text-3">
								Name *
							</label>
							<input
								id="int-name"
								required
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								className={inputClass}
								placeholder="My Loki"
							/>
						</div>
						<div>
							<label htmlFor="int-url" className="mb-1 block text-xs text-text-3">
								Loki URL *
							</label>
							<input
								id="int-url"
								required
								type="url"
								value={form.url}
								onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
								className={inputClass}
								placeholder="https://loki.example.com"
							/>
						</div>
					</div>
				</section>

				<section className="space-y-3">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-text-4">
						Authentication
					</h3>
					<div className="flex gap-4">
						{(["none", "basic"] as AuthType[]).map((val) => (
							<label
								key={val}
								className="flex cursor-pointer items-center gap-2 text-sm text-text-2"
							>
								<input
									type="radio"
									name="authType"
									value={val}
									checked={form.authType === val}
									onChange={() => setForm((f) => ({ ...f, authType: val }))}
								/>
								{val === "none" ? "No authentication" : "Basic authentication"}
							</label>
						))}
					</div>
					{form.authType === "basic" && (
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="int-user" className="mb-1 block text-xs text-text-3">
									Username
								</label>
								<input
									id="int-user"
									value={form.authUsername}
									onChange={(e) => setForm((f) => ({ ...f, authUsername: e.target.value }))}
									className={inputClass}
									autoComplete="off"
								/>
							</div>
							<div>
								<label htmlFor="int-pass" className="mb-1 block text-xs text-text-3">
									Password{editing ? " (leave blank to keep existing)" : ""}
								</label>
								<input
									id="int-pass"
									type="password"
									value={form.authPassword}
									onChange={(e) => setForm((f) => ({ ...f, authPassword: e.target.value }))}
									className={inputClass}
									placeholder={editing ? "••••••" : ""}
									autoComplete="new-password"
								/>
							</div>
						</div>
					)}
				</section>

				<section className="space-y-3">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-text-4">
						Query
					</h3>
					<div>
						<label htmlFor="int-query" className="mb-1 block text-xs text-text-3">
							LogQL query
						</label>
						<div className="flex gap-2">
							<input
								id="int-query"
								value={form.lokiQuery}
								onChange={(e) => {
									setForm((f) => ({ ...f, lokiQuery: e.target.value }));
									resetPreview();
								}}
								className={`${inputClass} flex-1 font-mono`}
							/>
							<button
								type="button"
								disabled={previewing || !form.url}
								onClick={handlePreview}
								className="whitespace-nowrap rounded border border-edge px-3 py-1.5 text-xs text-text-2 transition-colors hover:bg-surface-800 hover:text-text-1 disabled:opacity-40"
							>
								{previewing ? "Loading…" : "Preview ▶"}
							</button>
						</div>
					</div>
					{(previewEvents !== null || previewError) && (
						<div className="space-y-2 rounded border border-edge bg-surface-800 p-3 text-xs">
							<p className="font-medium text-text-3">Preview — last 7 days</p>
							{previewError && <p className="text-danger">{previewError}</p>}
							{previewEvents !== null && previewEvents.length === 0 && (
								<p className="text-text-4">No matching events found in the last 7 days.</p>
							)}
							{previewEvents !== null && previewEvents.length > 0 && (
								<ul className="space-y-2">
									{previewEvents.map((ev, i) => {
										const label = ev.eventName.replace("claude_code.", "");
										const skillName = ev.attributes["skill.name"] as string | undefined;
										const pluginName = ev.attributes["plugin.name"] as string | undefined;
										const detail = skillName ?? pluginName ?? null;
										return (
											// biome-ignore lint/suspicious/noArrayIndexKey: static preview list
											<li key={i} className="flex flex-col gap-0.5">
												<div className="flex items-center gap-2">
													<span className="badge badge-neutral">{label}</span>
													{detail && (
														<span className="font-medium text-text-1">{detail}</span>
													)}
												</div>
												<div className="text-text-4">
													{ev.userEmail ?? "unknown"} · {formatDateTime(ev.timestamp)}
												</div>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					)}
				</section>

				<section className="space-y-3">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-text-4">
						Schedule
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label htmlFor="int-interval" className="mb-1 block text-xs text-text-3">
								Sync interval (seconds)
							</label>
							<input
								id="int-interval"
								type="number"
								min="5"
								value={form.syncIntervalSecs}
								onChange={(e) =>
									setForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))
								}
								className={inputClass}
							/>
						</div>
						<label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-text-2">
							<input
								type="checkbox"
								checked={form.enabled}
								onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
							/>
							Enable sync
						</label>
					</div>
				</section>
			</form>
		</Drawer>
	);
}
