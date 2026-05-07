import { useAuth } from "@/context/AuthContext";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const { firstLogin } = await login(email, password);
			navigate(firstLogin ? "/onboarding" : "/dashboard", { replace: true });
		} catch {
			setError("Invalid email or password.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-surface-950 dot-grid">
			<div className="w-full max-w-sm bg-surface-700 rounded-xl shadow-2xl shadow-black/60 border border-edge p-8">
				<div className="mb-6">
					<span className="text-accent-soft text-2xl leading-none">◈</span>
					<h1 className="mt-3 text-xl font-semibold text-text-1">Sign in</h1>
					<p className="mt-1 text-sm text-text-3">Skills Observability</p>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-text-2 mb-1" htmlFor="email">
							Email
						</label>
						<input
							id="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-md border border-edge bg-surface-800 px-3 py-2 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright focus:border-accent-bright"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-text-2 mb-1" htmlFor="password">
							Password
						</label>
						<input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-md border border-edge bg-surface-800 px-3 py-2 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright focus:border-accent-bright"
						/>
					</div>
					{error && <p className="text-sm text-danger">{error}</p>}
					<button
						type="submit"
						disabled={loading}
						className="btn-primary w-full rounded-md px-4 py-2 text-sm font-medium"
					>
						{loading ? "Signing in…" : "Sign in"}
					</button>
				</form>
			</div>
		</div>
	);
}
