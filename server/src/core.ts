// The shared calculation engine (packages/core), imported by file path rather
// than as the '@calc/core' package. That package points at TypeScript source
// (src/index.ts), which Vercel's function build compiles to .js, so the
// package entry would not exist once deployed. A relative path works both
// locally (tsx) and on Vercel.
export * from '../../packages/core/src/index.js';
