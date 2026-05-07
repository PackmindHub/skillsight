import { api } from "@/lib/api";
import type { User } from "@/types/api";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

interface AuthState {
	user: User | null;
	firstLogin: boolean;
	loading: boolean;
}

interface AuthContextValue extends AuthState {
	login: (email: string, password: string) => Promise<{ firstLogin: boolean }>;
	logout: () => Promise<void>;
	markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({ user: null, firstLogin: false, loading: true });

	useEffect(() => {
		api.auth
			.me()
			.then(({ user, firstLogin }: { user: User; firstLogin: boolean }) =>
				setState({ user, firstLogin, loading: false }),
			)
			.catch(() => setState({ user: null, firstLogin: false, loading: false }));
	}, []);

	async function login(email: string, password: string) {
		const { user, firstLogin } = await api.auth.login(email, password);
		setState({ user, firstLogin, loading: false });
		return { firstLogin };
	}

	async function logout() {
		await api.auth.logout().catch(() => {});
		setState({ user: null, firstLogin: false, loading: false });
	}

	async function markOnboardingComplete() {
		await api.auth.onboardingComplete();
		setState((s) => ({ ...s, firstLogin: false }));
	}

	return (
		<AuthContext.Provider value={{ ...state, login, logout, markOnboardingComplete }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
