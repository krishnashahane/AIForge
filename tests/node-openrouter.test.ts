import { fetchOpenRouterPricingMap } from "../src/node/openrouter.js";

describe("aiforge/node openrouter", () => {
	it("fetches and converts valid pricing data", async () => {
		const fetchImpl = async () =>
			new Response(
				JSON.stringify({
					data: [
						{ id: "openai/gpt-5.2", pricing: { prompt: 2, completion: 10 } },
						{ id: "xai/grok-4", pricing: { prompt: 3, completion: 15 } },
						null,
						{ pricing: { prompt: 1, completion: 1 } },
					],
				}),
				{ status: 200 },
			);

		const map = await fetchOpenRouterPricingMap({
			apiKey: " test-key ",
			fetchImpl,
			ttlMs: 1_000_000,
		});
		expect(map["openai/gpt-5.2"]?.inputUsdPerToken).toBeCloseTo(2 / 1_000_000);
		expect(map["openai/gpt-5.2"]?.outputUsdPerToken).toBeCloseTo(10 / 1_000_000);
		expect(map["xai/grok-4"]?.inputUsdPerToken).toBeCloseTo(3 / 1_000_000);
	});

	it("rejects an empty API key", async () => {
		await expect(
			fetchOpenRouterPricingMap({
				apiKey: "   ",
				fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
			}),
		).rejects.toThrow("OpenRouter API key is required.");
	});

	it("rejects an invalid cache TTL", async () => {
		await expect(
			fetchOpenRouterPricingMap({
				apiKey: "test",
				fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
				ttlMs: -1,
			}),
		).rejects.toThrow("ttlMs must be a finite, non-negative number.");
	});
});
