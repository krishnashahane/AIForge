/** Minimal `fetch` signature used by AIForge's Node helpers. */
export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
