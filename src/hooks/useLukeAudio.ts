import { useState, useRef, useEffect } from "react";
import axios from "axios";

interface UseLukeTokenProps {
  sessionId: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export const useLukeToken = ({
  sessionId,
  enabled = false,
  onError,
}: UseLukeTokenProps) => {
  const [lukeToken, setLukeToken] = useState<string | null>(null);
  const [lukeWsUrl, setLukeWsUrl] = useState<string | null>(null);
  const tokenFetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || tokenFetchedRef.current) return;

    const fetchToken = async () => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/realtime/luke-token/${sessionId}`,
        );
        const { token } = response.data;
        setLukeToken(token);

        const backendUrl = new URL(import.meta.env.VITE_APP_BACKEND);
        const wsProtocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${backendUrl.host}/luke`;
        setLukeWsUrl(wsUrl);
        tokenFetchedRef.current = true;
      } catch (error) {
        console.error("Failed to fetch luke token:", error);
        onError?.(
          error instanceof Error
            ? error
            : new Error("Failed to fetch luke token"),
        );
      }
    };

    fetchToken();
  }, [enabled, sessionId, onError]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      tokenFetchedRef.current = false;
      setLukeToken(null);
      setLukeWsUrl(null);
    }
  }, [enabled]);

  return {
    token: lukeToken,
    wsUrl: lukeWsUrl,
    isReady: !!lukeToken && !!lukeWsUrl,
  };
};
