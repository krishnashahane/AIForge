import { createHash } from "node:crypto";
import { pricingFromUsdPerMillion } from "../pricing.js";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const catalogCache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
function cacheKey(apiKey) {
    return createHash("sha256").update(apiKey, "utf8").digest("hex");
}
function isValidModelInfo(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const entry = value;
    return typeof entry.id === "string" && entry.id.trim().length > 0;
}
export async function fetchOpenRouterModelCatalog({ apiKey, fetchImpl, ttlMs = DEFAULT_TTL_MS, }) {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey)
        throw new Error("OpenRouter API key is required.");
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        throw new Error("ttlMs must be a finite, non-negative number.");
    }
    const key = cacheKey(normalizedKey);
    const cached = catalogCache.get(key);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < ttlMs)
        return cached.models;
    const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
        headers: { authorization: `Bearer ${normalizedKey}` },
    });
    if (!response.ok) {
        throw new Error(`Failed to load OpenRouter models (${response.status})`);
    }
    const json = (await response.json());
    const models = Array.isArray(json?.data) ? json.data.filter(isValidModelInfo) : [];
    catalogCache.set(key, { fetchedAt: now, models });
    return models;
}
export function openRouterPricingMapFromCatalog(catalog) {
    const map = {};
    for (const entry of catalog) {
        const id = entry.id.trim();
        if (!id)
            continue;
        const prompt = entry.pricing?.prompt;
        const completion = entry.pricing?.completion;
        if (typeof prompt === "number" &&
            Number.isFinite(prompt) &&
            prompt >= 0 &&
            typeof completion === "number" &&
            Number.isFinite(completion) &&
            completion >= 0) {
            map[id] = pricingFromUsdPerMillion({
                inputUsdPerMillion: prompt,
                outputUsdPerMillion: completion,
            });
        }
    }
    return map;
}
export async function fetchOpenRouterPricingMap({ apiKey, fetchImpl, ttlMs, }) {
    const catalog = await fetchOpenRouterModelCatalog({ apiKey, fetchImpl, ttlMs });
    return openRouterPricingMapFromCatalog(catalog);
}
