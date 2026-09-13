// Runs once per e2e test file (vitest.config.e2e.ts's setupFiles), before
// that file's tests. Must load .env.test — not just rely on
// global-setup.ts having already run — because Vitest doesn't guarantee
// process.env mutations from globalSetup propagate into the worker
// process that actually executes the tests.
import { config } from 'dotenv';

config({ path: '.env.test', quiet: true });
