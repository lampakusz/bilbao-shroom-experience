/**
 * assetPath.ts
 * Resolves asset paths relative to the app's base URL (import.meta.env.BASE_URL).
 * Needed for GitHub Pages deployments where the app lives under a subpath
 * e.g. /bilbao-shroom-experience/ instead of /.
 */

const _base: string =
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL
    : './';

/**
 * Converts a path like '/textures/foo.png' or 'textures/foo.png'
 * into a fully resolved URL relative to the app base.
 * Absolute URLs (http/https/data:) are returned unchanged.
 */
export function resolveAssetPath(path: string): string {
  if (!path) return path;
  // Already absolute – leave untouched
  if (/^(https?:|\/\/|data:)/i.test(path)) return path;
  // Strip leading './' or '/'
  const cleanPath = path.replace(/^(\.\/|\/)/, '');
  const cleanBase = _base.endsWith('/') ? _base : _base + '/';
  return cleanBase + cleanPath;
}
