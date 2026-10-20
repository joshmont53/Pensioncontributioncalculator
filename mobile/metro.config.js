const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// packages/core writes its relative imports with a .js extension
// ("./taxConfig.js") so the deployed Vercel functions can load them in Node.
// Vite and tsx map those to the .ts source; Metro doesn't, so retry without
// the extension when the .js file itself doesn't exist.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
