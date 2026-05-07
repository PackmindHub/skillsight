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
		<header className="h-12 shrink-0 border-b border-gray-200 bg-white flex items-center justify-end px-6 gap-4">
			{user && <span className="text-sm text-gray-600">{user.email}</span>}
			<button
				type="button"
				onClick={handleLogout}
				className="text-sm text-gray-500 hover:text-gray-900"
			>
				Logout
			</button>
		</header>
	);
}
