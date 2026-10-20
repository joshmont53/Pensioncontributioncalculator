// Load ANTHROPIC_API_KEY (and anything else) from the repo-root .env file, if
// there is one. Imported first in index.ts: ES module imports run before the
// importing file's own code, so modules that create a Claude client at import
// time (explain.ts) need the key in place already.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file: fall back to whatever is already in the environment.
}
