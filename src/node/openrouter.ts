import { createHash } from "node:crypto";

import { pricingFromUsdPerMillion } from "../pricing.js";
import type { PricingMap } from "../types.js";
import type { FetchFn } from "./types.js";

const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

/** Minimal subset of OpenRouter model info used for pricing + limits. */
export type OpenRouterModelInfo = {
	id: string;
	context_length?: number;
	pricing?: {
		prompt?: number;
		completion?: number;
	};
};

const catalogCache = new Map<string, { fetchedAt: number; models: OpenRouterModelInfo[] }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cacheKey(apiKey: string): string {
	return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

function isValidModelInfo(value: unknown): value is OpenRouterModelInfo {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const entry = value as Record<string, unknown>;
	return typeof entry.id === "string" && entry.id.trim().length > 0;
}

/**
 * Fetches the OpenRouter model catalog with a short in-memory cache.
 *
 * The API key is hashed before use as the cache key so the secret is not retained
 * verbatim by this module.
 */
export async function fetchOpenRouterModelCatalog({
	apiKey,
	fetchImpl,
	ttlMs = DEFAULT_TTL_MS,
}: {
	apiKey: string;
	fetchImpl: FetchFn;
	ttlMs?: number;
}): Promise<OpenRouterModelInfo[]> {
	const normalizedKey = apiKey.trim();
	if (!normalizedKey) throw new Error("OpenRouter API key is required.");
	if (!Number.isFinite(ttlMs) || ttlMs < 0) {
		throw new Error("ttlMs must be a finite, non-negative number.");
	}

	const key = cacheKey(normalizedKey);
	const cached = catalogCache.get(key);
	const now = Date.now();
	if (cached && now - cached.fetchedAt < ttlMs) return cached.models;

	const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
		headers: { authorization: `Bearer ${normalizedKey}` },
	});
	if (!response.ok) {
		throw new Error(`Failed to load OpenRouter models (${response.status})`);
	}
	const json = (await response.json()) as { data?: unknown };
	const models = Array.isArray(json?.data) ? json.data.filter(isValidModelInfo) : [];
	catalogCache.set(key, { fetchedAt: now, models });
	return models;
}

/**
 * Converts OpenRouter catalog pricing to a PricingMap.
 * Entries without valid pricing are skipped.
 */
export function openRouterPricingMapFromCatalog(catalog: OpenRouterModelInfo[]): PricingMap {
	const map: PricingMap = {};
	for (const entry of catalog) {
		const id = entry.id.trim();
		if (!id) continue;
		const prompt = entry.pricing?.prompt;
		const completion = entry.pricing?.completion;
		if (
			typeof prompt === "number" &&
			Number.isFinite(prompt) &&
			prompt >= 0 &&
			typeof completion === "number" &&
			Number.isFinite(completion) &&
			completion >= 0
		) {
			map[id] = pricingFromUsdPerMillion({
				inputUsdPerMillion: prompt,
				outputUsdPerMillion: completion,
			});
		}
	}
	return map;
}

/** Convenience wrapper: fetch catalog → convert to pricing map. */
export async function fetchOpenRouterPricingMap({
	apiKey,
	fetchImpl,
	ttlMs,
}: {
	apiKey: string;
	fetchImpl: FetchFn;
	ttlMs?: number;
}): Promise<PricingMap> {
	const catalog = await fetchOpenRouterModelCatalog({ apiKey, fetchImpl, ttlMs });
	return openRouterPricingMapFromCatalog(catalog);
}
