import { cn } from "@/lib/utils";
import type { MarketplaceStatus } from "@/types/api";

const STATUS_STYLES: Record<string, string> = {
	approved: "bg-success/15 text-success border-success/30",
	denied: "bg-danger/15 text-danger border-danger/30",
	to_review: "bg-warning/15 text-warning border-warning/30",
};

interface MarketplaceBadgeProps {
	name: string;
	status?: MarketplaceStatus | null;
	className?: string;
	onClick?: (e: React.MouseEvent) => void;
}

export function MarketplaceBadge({ name, status, className, onClick }: MarketplaceBadgeProps) {
	const style = STATUS_STYLES[status ?? "to_review"] ?? STATUS_STYLES.to_review;
	return (
		<a
			href={`/marketplaces?name=${encodeURIComponent(name)}`}
			target="_blank"
			rel="noopener noreferrer"
			onClick={onClick}
			title={`Open marketplace ${name} in a new tab`}
			className={cn(
				"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono hover:underline",
				style,
				className,
			)}
		>
			{name}
		</a>
	);
}
