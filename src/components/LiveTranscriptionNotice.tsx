import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

export const LiveTranscriptionNotice: React.FC = () => {
	return (
		<div
			className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm"
			role="status"
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
					aria-hidden="true"
				/>

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

