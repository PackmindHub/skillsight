import { useAuth } from "@/context/AuthContext";
import { Button, Card, FormField, Input } from "@/components/ui";
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
			<Card surface="raised" padding="lg" className="w-full max-w-sm">
				<div className="mb-6">
					<span className="text-accent-soft text-2xl leading-none">◈</span>
					<h1 className="mt-3 text-xl font-semibold text-text-1">Sign in</h1>
					<p className="mt-1 text-sm text-text-3">Skillsight</p>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<FormField label="Email" htmlFor="email">
						<Input
							id="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</FormField>
					<FormField label="Password" htmlFor="password" error={error ?? undefined}>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							invalid={Boolean(error)}
						/>
					</FormField>
					<Button type="submit" loading={loading} fullWidth>
						Sign in
					</Button>
				</form>
			</Card>
		</div>
	);
}
