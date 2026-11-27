// Features that are still being tried out are only offered on the preview
// deployments (pre.workbench.leia.ovh, pre-<n>.workbench.leia.ovh) and on a
// local development server.

const PREVIEW_HOST = /^pre(?:-\d+)?\.workbench\.leia\.ovh$/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

export function isPreviewHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  return PREVIEW_HOST.test(host) || LOCAL_HOSTS.includes(host);
}
