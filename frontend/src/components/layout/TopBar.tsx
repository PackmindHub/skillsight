import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export function TopBar() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	async function handleLogout() {
		await logout();
		navigate("/login");
	}

	return (
		<header className="h-12 shrink-0 border-b border-edge bg-surface-900 flex items-center justify-end px-6 gap-4">
			{user && <span className="text-sm text-text-3">{user.email}</span>}
			<button
				type="button"
				onClick={handleLogout}
				className="text-sm text-text-3 hover:text-text-1 transition-colors"
			>
				Logout
			</button>
		</header>
	);
}
