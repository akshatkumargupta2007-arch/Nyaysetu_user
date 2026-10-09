// Request logging must never contain a usable login token. The live streams (/me/stream and /reports/:id/stream)
// are opened by the browser's EventSource, which cannot set an Authorization header, so the token travels in the
// query string. That is fine on the wire (HTTPS) but it must not end up in our own logs.
const SECRET_PARAMS = /([?&](?:token|access_token|jwt|key)=)[^&#\s]*/gi;

export function redactUrl(url: string | undefined): string | undefined {
  return url ? url.replace(SECRET_PARAMS, "$1[redacted]") : url;
}

/** pino `req` serializer: the default fields (method, url, host, remote address) with the url cleaned. */
export function reqSerializer(req: { method?: string; url?: string; hostname?: string; host?: string; ip?: string; socket?: { remotePort?: number } }) {
  return {
    method: req.method,
    url: redactUrl(req.url),
    host: req.host ?? req.hostname,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  };
}
