/**
 * The SDK's own endpoints, remembered from `init` so the network capture can skip them.
 *
 * A module rather than a field on either side, because both `index` and `network` need it and
 * having `network` import `index` would be a cycle — `index` re-exports `captureNetwork`.
 *
 * Nothing routes to these through `XMLHttpRequest` today; the SDKs upload natively. This is here so
 * that if anything ever does, the measurement does not start measuring itself and growing with
 * every batch it sends.
 */
let urls: string[] = [];

export function rememberUrls(ingestUrl: string, apiUrl: string): void {
  urls = [ingestUrl, apiUrl].filter((u) => typeof u === 'string' && u.length > 0);
}

export function reportedUrls(): string[] {
  return urls;
}
