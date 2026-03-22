const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow CSS files (needed for mapbox-gl on web)
config.resolver.sourceExts.push("css");

// Stub mapbox-gl CSS import — Metro can't process CSS files natively
// The CSS is loaded via CDN in the HTML template instead
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith(".css")) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
