import React, { useEffect, useState, useRef } from "react";
import { ClockIcon } from "@heroicons/react/24/outline";

interface SessionTimerProps {
  durationMinutes: number;
  sessionStartedAt: string; // ISO string — finishTime = startedAt + duration
  onExpire: () => void;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  durationMinutes,
  sessionStartedAt,
  onExpire,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!durationMinutes || durationMinutes <= 0 || !sessionStartedAt) return;

    // Deterministic: finishTime is always startedAt + duration, survives page refreshes
    const finishTime = new Date(sessionStartedAt).getTime() + durationMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.floor((finishTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current();
        }
      } else {
        setSecondsLeft(remaining);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [durationMinutes, sessionStartedAt]);

  if (secondsLeft === null) return null;

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const isWarning = secondsLeft <= 60;
  const isCritical = secondsLeft <= 0;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-mono font-medium ${
        isCritical
          ? "bg-red-100 text-red-700 border border-red-300"
          : isWarning
          ? "bg-orange-100 text-orange-700 border border-orange-300 animate-pulse"
          : "bg-gray-100 text-gray-700 border border-gray-300"
      }`}
    >
      <ClockIcon className="w-4 h-4 flex-shrink-0" />
      <span>
        {hours > 0
          ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
          : `${pad(minutes)}:${pad(seconds)}`}
      </span>
    </div>
  );
};