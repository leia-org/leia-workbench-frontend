export async function safeJsonParse(response: Response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return null;
  }
}

// Lightweight authenticated fetch wrapper. Returns the raw Response and parsed JSON (if any).
export async function authFetch(url: string, token: string|null, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await safeJsonParse(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { res, data } as { res: Response; data: any };
}