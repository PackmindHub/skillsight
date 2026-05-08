export function SourceErrorBanner({ message }: { message: string }) {
	return (
		<div
			role="alert"
			className="mx-5 mt-3 flex items-start gap-2 rounded border border-danger/30 bg-danger/10 px-3 py-2"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
				className="mt-0.5 shrink-0 text-danger"
			>
				<path d="M10 1.5 19 18H1L10 1.5Zm0 6.25a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0V8.5A.75.75 0 0 0 10 7.75Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
			</svg>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-semibold text-danger">Sync failed</p>
				<pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-text-2">
					{message}
				</pre>
			</div>
		</div>
	);
}
