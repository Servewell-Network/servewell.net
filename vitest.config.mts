import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		// Only the files that actually require the Workers runtime.
		// Other test files run via vitest.node.config.mts (see test:inventory).
		include: [
			'test/index.spec.ts',
			'test/api-contracts.spec.ts',
			'test/word-search-logic.spec.ts',
		],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
