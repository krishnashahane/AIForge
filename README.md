# AIForge

AIForge is a small TypeScript library for normalizing LLM token usage, calculating USD costs, and resolving model pricing from provider catalogs.

## What it provides

- Normalize common token-usage payloads into one shape.
- Convert published USD-per-million prices into per-token pricing.
- Resolve pricing from model maps, including common provider prefixes.
- Aggregate usage and cost by model.
- Fetch OpenRouter model pricing at runtime.
- Load and cache the LiteLLM model-pricing catalog in Node.js.
- Resolve best-effort input/output token limits from LiteLLM metadata.

AIForge does not call LLM chat/completion APIs. It accounts for usage and pricing data you provide or resolve through the optional Node adapters.

## Requirements

- Node.js 20+
- pnpm 10.34.5+ for development

## Installation

~~~bash
git clone https://github.com/krishnashahane/aiforge.git
cd aiforge
pnpm install
~~~

Build the package:

~~~bash
pnpm build
~~~

## Core usage

### Normalize token usage

~~~ts
import { normalizeTokenUsage } from "aiforge";

const usage = normalizeTokenUsage({
  prompt_tokens: 1200,
  completion_tokens: 300,
});

console.log(usage);
// { inputTokens: 1200, outputTokens: 300, totalTokens: 1500 }
~~~

### Create pricing

~~~ts
import { pricingFromUsdPerMillion } from "aiforge";

const pricing = pricingFromUsdPerMillion({
  inputUsdPerMillion: 2,
  outputUsdPerMillion: 10,
});
~~~

### Estimate a single call

~~~ts
import { estimateUsdCost } from "aiforge";

const cost = estimateUsdCost({
  usage: {
    inputTokens: 1200,
    outputTokens: 300,
  },
  pricing,
});

console.log(cost);
// { inputUsd: ..., outputUsd: ..., totalUsd: ... }
~~~

### Aggregate multiple calls

~~~ts
import { tallyCosts } from "aiforge";

const result = await tallyCosts({
  calls: [
    {
      model: "openai/gpt-5.2",
      usage: { inputTokens: 1200, outputTokens: 300 },
    },
  ],
  resolvePricing: async (modelId) => {
    // Resolve modelId from your own pricing table or provider catalog.
    return pricing;
  },
});
~~~

## Node adapters

Node-only helpers are available from the `aiforge/node` export.

### OpenRouter

An OpenRouter API key is required to fetch the public model catalog:

~~~ts
import { fetchOpenRouterPricingMap } from "aiforge/node";

const pricingMap = await fetchOpenRouterPricingMap({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  fetchImpl: fetch,
});
~~~

The helper validates the key and cache TTL, filters malformed model records, and hashes the API key before using it as an in-memory cache key.

### LiteLLM

The LiteLLM catalog is fetched from its public GitHub raw file and cached locally.

~~~ts
import { loadLiteLlmCatalog, resolveLiteLlmPricing } from "aiforge/node";

const loaded = await loadLiteLlmCatalog({
  env: process.env,
  fetchImpl: fetch,
});

const pricing = loaded.catalog
  ? resolveLiteLlmPricing(loaded.catalog, "openai/gpt-5.2")
  : null;
~~~

Cache location:

- `AIFORGE_CACHE_DIR` when set
- otherwise `$HOME/.aiforge/cache`

## API surface

### Core

- `normalizeTokenUsage(raw)`
- `pricingFromUsdPerMillion({ inputUsdPerMillion, outputUsdPerMillion })`
- `pricingFromUsdPerToken({ inputUsdPerToken, outputUsdPerToken })`
- `resolvePricingFromMap(map, modelId)`
- `estimateUsdCost({ usage, pricing })`
- `tallyCosts({ calls, resolvePricing })`

### Node

- `fetchOpenRouterModelCatalog({ apiKey, fetchImpl, ttlMs })`
- `fetchOpenRouterPricingMap({ apiKey, fetchImpl, ttlMs })`
- `openRouterPricingMapFromCatalog(catalog)`
- `loadLiteLlmCatalog({ env, fetchImpl, nowMs })`
- `resolveLiteLlmPricing(catalog, modelId)`
- `resolveLiteLlmMaxOutputTokens(catalog, modelId)`
- `resolveLiteLlmMaxInputTokens(catalog, modelId)`

## Development

Run the test suite:

~~~bash
pnpm test
~~~

Run coverage:

~~~bash
pnpm test:coverage
~~~

Run type checking:

~~~bash
pnpm typecheck
~~~

Run the full project gate:

~~~bash
pnpm check
~~~

## Security

- Provider API keys are never written to disk by the library.
- The OpenRouter cache hashes the API key instead of retaining it verbatim in the cache map.
- External model catalogs are treated as untrusted JSON; malformed records are ignored.
- Pricing values are accepted only when they are finite and non-negative.
- Token counts are normalized to finite, non-negative integers.
- LiteLLM cache paths are resolved before file access.

Do not expose provider API keys in logs, source control, or client-side code.

### Dependency security

The repository's original pnpm version was below the patched range for several 2026 pnpm advisories, so the package manager requirement is now pinned to pnpm 10.34.5+. pnpm 10.34.0+ is also required to avoid a 2026 path-traversal advisory affecting earlier 10.x releases. citeturn696084search4turn696084search6

Vitest was raised from 4.0.x to the 4.1.x line because Vitest 4.0.x was affected by a critical file-read/execute advisory; the official advisory lists 4.1.0 as the patched 4.x baseline. citeturn857364view0

The checked-in lockfile was created with the previous dependency set. In this environment I could not reach the npm registry to regenerate it, so run `pnpm install` once after pulling these changes to refresh `pnpm-lock.yaml` before using `--frozen-lockfile` in CI.

## Project structure

~~~text
aiforge/
├── src/
│   ├── index.ts
│   ├── pricing.ts
│   ├── tally.ts
│   ├── types.ts
│   ├── usage.ts
│   └── node/
│       ├── index.ts
│       ├── litellm.ts
│       ├── openrouter.ts
│       └── types.ts
├── tests/
├── dist/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
~~~

## License

MIT
