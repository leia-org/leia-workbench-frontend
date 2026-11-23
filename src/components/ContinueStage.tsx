import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export interface StageProgress {
  number: number;
  total: number;
  hasNext: boolean;
}

export function ContinueStage({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const next = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post<{ sessionId: string }>(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/next-stage`,
      );
      navigate(`/chat/${data.sessionId}`, { replace: true });
    } catch (err) {
      setError((axios.isAxiosError(err) && err.response?.data?.message) || "Could not open the next stage. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" disabled={loading} onClick={() => void next()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {loading ? "Opening next stage…" : "Continue to next stage"}
      </button>
    </div>
  );
}
