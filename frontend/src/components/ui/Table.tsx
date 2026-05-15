import {
	type HTMLAttributes,
	type TableHTMLAttributes,
	type TdHTMLAttributes,
	type ThHTMLAttributes,
	forwardRef,
} from "react";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";

const ALIGN: Record<Align, string> = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
};

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
	dense?: boolean;
}

export function Table({ dense, className, children, ...rest }: TableProps) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border border-edge bg-surface-900",
				dense && "text-sm",
			)}
		>
			<div className="overflow-x-auto">
				<table className={cn("min-w-full text-sm text-text-2", className)} {...rest}>
					{children}
				</table>
			</div>
		</div>
	);
}

export function THead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
	return (
		<thead
			className={cn(
				"border-b border-edge bg-gradient-to-b from-accent-bright/[0.04] to-transparent text-text-4",
				className,
			)}
			{...rest}
		>
			{children}
		</thead>
	);
}

export function TBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
	return (
		<tbody className={cn("divide-y divide-edge-dim", className)} {...rest}>
			{children}
		</tbody>
	);
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
	highlighted?: boolean;
}

export const TR = forwardRef<HTMLTableRowElement, TRProps>(function TR(
	{ highlighted, className, children, onClick, ...rest },
	ref,
) {
	const interactive = onClick !== undefined;
	return (
		<tr
			ref={ref}
			onClick={onClick}
			className={cn(
				interactive && "cursor-pointer hover:bg-surface-800/60",
				highlighted && "bg-accent-bright/5",
				className,
			)}
			{...rest}
		>
			{children}
		</tr>
	);
});

interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
	align?: Align;
}

export function TH({ align = "left", className, children, ...rest }: THProps) {
	return (
		<th
			className={cn(
				"h-9 px-4 font-mono text-[10px] uppercase tracking-wider text-text-4",
				ALIGN[align],
				className,
			)}
			{...rest}
		>
			{children}
		</th>
	);
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
	align?: Align;
	numeric?: boolean;
}

export function TD({ align, numeric, className, children, ...rest }: TDProps) {
	const finalAlign = align ?? (numeric ? "right" : undefined);
	return (
		<td
			className={cn(
				"px-4 py-3 text-text-1",
				finalAlign && ALIGN[finalAlign],
				numeric && "tabular-nums",
				className,
			)}
			{...rest}
		>
			{children}
		</td>
	);
}

interface EmptyRowProps {
	colSpan: number;
	children: React.ReactNode;
}

export function EmptyRow({ colSpan, children }: EmptyRowProps) {
	return (
		<tr>
			<td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-text-3">
				{children}
			</td>
		</tr>
	);
}
