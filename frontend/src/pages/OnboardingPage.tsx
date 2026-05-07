import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OnboardingPage() {
	const navigate = useNavigate();
	const { markOnboardingComplete } = useAuth();
	const [baseUrl, setBaseUrl] = useState("https://your-domain.com");
	const [jwt, setJwt] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		Promise.all([
			api.config.get().then((cfg) => setBaseUrl(cfg.baseUrl)),
			api.tokens
				.create({ name: "default-ingestion", expiresAt: expiresAt.toISOString() })
				.then((t) => setJwt(t.jwt))
				.catch((e) => setError(String(e))),
		]).catch(() => {});
	}, []);

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
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
				<h1 className="text-xl font-semibold text-gray-900">Welcome — Setup Claude Code</h1>
				<p className="text-sm text-gray-600">
					Add this block to your team's{" "}
					<code className="bg-gray-100 px-1 rounded">settings.json</code> to start sending telemetry
					to this instance. The token has been generated and saved.
				</p>

				{error && <p className="text-sm text-red-600">Failed to generate token: {error}</p>}

				<div className="relative">
					<pre className="rounded-lg bg-gray-900 text-gray-100 text-xs p-4 overflow-x-auto font-mono">
						{envBlock}
					</pre>
					<button
						type="button"
						onClick={copy}
						className="absolute top-3 right-3 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
					>
						{copied ? "Copied!" : "Copy"}
					</button>
				</div>

				<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
					The token is shown here only once. If you lose it, generate a new one from the Tokens
					page.
				</p>

				<button
					type="button"
					onClick={finish}
					disabled={!jwt}
					className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					Go to Dashboard
				</button>
			</div>
		</div>
	);
}
