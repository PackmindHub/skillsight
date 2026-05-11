import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<>
			<div className="app-bg" aria-hidden="true" />
			<div className="relative z-10 flex h-screen text-text-1">
				<Sidebar />
				<div className="flex flex-1 flex-col overflow-hidden">
					<TopBar />
					<main className="flex-1 overflow-y-auto px-6 pb-12 pt-5">{children}</main>
				</div>
			</div>
		</>
	);
}
