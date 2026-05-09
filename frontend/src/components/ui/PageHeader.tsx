import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
	eyebrow?: ReactNode;
	className?: string;
}

export function PageHeader({ title, subtitle, actions, eyebrow, className }: PageHeaderProps) {
	return (
		<header
			className={cn(
				"mb-6 flex flex-wrap items-start justify-between gap-3",
				className,
			)}
		>
			<div className="min-w-0">
				{eyebrow && (
					<p className="text-xs font-medium uppercase tracking-wider text-text-3">
						{eyebrow}
					</p>
				)}
				<h1 className="text-2xl font-semibold text-text-1">{title}</h1>
				{subtitle && <p className="mt-1 text-sm text-text-3">{subtitle}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</header>
	);
}
