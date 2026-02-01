// Utility to resolve asset paths for both development and production Electron builds
// In dev: assets are served from the Vite dev server at absolute paths
// In prod: assets need to be relative to the loaded HTML file

/**
 * Resolves an asset path that works in both dev and production Electron builds.
 * @param {string} path - The asset path starting with / (e.g., '/images/heroes/Archer.jpg')
 * @returns {string} - The resolved path
 */
export function getAssetPath(path) {
  // If path doesn't start with /, return as-is
  if (!path || !path.startsWith('/')) {
    return path;
  }
  
  // In production Electron (file:// protocol), use relative paths
  // In development (http://), absolute paths work fine
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    // Remove leading slash and make relative
    return '.' + path;
  }
  
  // In development or web, return the original path
  return path;
}

export default getAssetPath;
