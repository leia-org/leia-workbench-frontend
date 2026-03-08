import React from "react";

export const LiveTranscriptionNotice: React.FC = () => {
	return (
		<div
			className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm"
			role="status"
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<svg
					className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fillRule="evenodd"
						d="M18 10A8 8 0 114.293 4.293 8 8 0 0118 10zM9 7a1 1 0 012 0v3a1 1 0 11-2 0V7zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z"
						clipRule="evenodd"
					/>
				</svg>

				<div>
					<p className="text-sm font-semibold">Live transcription is disabled</p>
					<p className="mt-1 text-sm text-amber-800">
						Audio responses are still available, but spoken content will not be shown in the chat.
					</p>
				</div>
			</div>
		</div>
	);
};

