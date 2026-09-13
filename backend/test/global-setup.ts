// Runs once for the whole e2e run (vitest.config.e2e.ts's globalSetup),
// before any test file. Applies migrations to the test database — assumes
// `docker compose --profile test up -d postgres-test` has already been run
// (see backend/CLAUDE.md); this does not start that container itself.
import { execSync } from 'node:child_process';
import { config } from 'dotenv';

export default function setup() {
  const env = { ...process.env };
  config({ path: '.env.test', processEnv: env, quiet: true });

  execSync('npx prisma migrate deploy', {
    cwd: import.meta.dirname + '/..',
    env,
    stdio: 'inherit',
  });
}
