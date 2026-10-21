const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`;
}

export function webSocketUrl(path) {
  const url = new URL(apiUrl(path), window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
