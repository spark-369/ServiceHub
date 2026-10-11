/**
 * Ambient declarations for CSS side-effect imports.
 *
 * `import "leaflet/dist/leaflet.css"` (and similar package stylesheets) is a
 * side-effect-only import: TypeScript cannot infer a type for a `.css` file, so
 * with the project's strict settings it reports:
 *
 *   Cannot find module or type declarations for side-effect import of
 *   'leaflet/dist/leaflet.css'.
 *
 * A single wildcard module declaration tells TypeScript that any `*.css`
 * specifier — including deep package paths such as `leaflet/dist/leaflet.css`
 * or a co-located `./globals.css` — is a valid, side-effect-only module.
 */
declare module "*.css";
