import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

export default function OnboardingPage() {
	const navigate = useNavigate();
	const { firstLogin, markOnboardingComplete } = useAuth();
	const [baseUrl, setBaseUrl] = useState("https://your-domain.com");
	const [jwt, setJwt] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const tokenCreated = useRef(false);

	useEffect(() => {
		if (!firstLogin || tokenCreated.current) return;
		tokenCreated.current = true;

		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		Promise.all([
			api.config.get().then((cfg) => setBaseUrl(cfg.baseUrl)),
			api.tokens
				.create({ name: "default-ingestion", expiresAt: expiresAt.toISOString() })
				.then((t) => setJwt(t.jwt))
				.catch((e) => setError(String(e))),
		]).catch(() => {});
	}, [firstLogin]);

	if (!firstLogin) return <Navigate to="/dashboard" replace />;

	const envBlock = `{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "${baseUrl}/api/v0/telemetry/v1/logs",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer ${jwt ?? "<token-loading>"}",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORT_INTERVAL": "5000",
    "OTEL_LOG_TOOL_DETAILS": "1",
    "OTEL_METRICS_EXPORTER": "none"
  }
}`;

	async function copy() {
		await navigator.clipboard.writeText(envBlock);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function finish() {
		await markOnboardingComplete();
		navigate("/dashboard", { replace: true });
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-surface-950 dot-grid">
			<div className="w-full max-w-2xl bg-surface-700 rounded-xl shadow-2xl shadow-black/60 border border-edge p-8 space-y-6">
				<div>
					<span className="text-accent-soft text-2xl leading-none">◈</span>
					<h1 className="mt-3 text-xl font-semibold text-text-1">Welcome — Setup Claude Code</h1>
				</div>
				<p className="text-sm text-text-2">
					Add this block to your team's{" "}
					<code className="bg-surface-800 text-accent-soft border border-edge-dim px-1 rounded text-[11px]">settings.json</code>{" "}
					to start sending telemetry to this instance. The token has been generated and saved.
				</p>

				{error && <p className="text-sm text-danger">Failed to generate token: {error}</p>}

				<div className="relative">
					<pre className="rounded-lg bg-surface-950 text-text-2 text-xs p-4 overflow-x-auto font-mono border border-edge">
						{envBlock}
					</pre>
					<button
						type="button"
						onClick={copy}
						className="absolute top-3 right-3 text-xs bg-surface-600 hover:bg-surface-700 text-text-2 px-2 py-1 rounded border border-edge transition-colors"
					>
						{copied ? "Copied!" : "Copy"}
					</button>
				</div>

				<p className="text-xs text-warning bg-warning/10 border border-warning/25 rounded-md px-3 py-2">
					The token is shown here only once. If you lose it, generate a new one from the Tokens page.
				</p>

				<button
					type="button"
					onClick={finish}
					disabled={!jwt}
					className="btn-primary w-full rounded-md px-4 py-2 text-sm font-medium"
				>
					Go to Dashboard
				</button>
			</div>
		</div>
	);
}
