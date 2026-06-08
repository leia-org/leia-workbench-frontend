// Lightweight localStorage cache of replication-id → name. Lets the
// admin sidebar show the actual replication name when a share-token
// visitor is scoped to a single replication, without having to fetch
// the replication itself from inside the sidebar.

const REPLICATION_NAMES_KEY = "replicationNames";

const readMap = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REPLICATION_NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
};

export const writeReplicationName = (id: string, name: string): void => {
  if (!id || !name || typeof window === "undefined") return;
  const map = readMap();
  if (map[id] === name) return;
  map[id] = name;
  try {
    window.localStorage.setItem(REPLICATION_NAMES_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded, ignore — the sidebar will fall back to a generic label */
  }
};

export const readReplicationName = (id: string): string | null => {
  if (!id) return null;
  const map = readMap();
  return map[id] || null;
};
