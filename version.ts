// ---------------------------------------------------------------------------
// Single source of truth for the application version.
// Follows Semantic Versioning (https://semver.org): MAJOR.MINOR.PATCH
//   MAJOR - breaking changes to the intake data model or workflow
//   MINOR - new fields, screens, or capabilities (backwards compatible)
//   PATCH - fixes and small improvements
// Bump this on every meaningful release so the deployed build is identifiable.
// ---------------------------------------------------------------------------

export const APP_VERSION = '1.7.0';

// Date this version was released (YYYY-MM-DD). Update alongside APP_VERSION.
export const BUILD_DATE = '2026-10-06';

// Human-friendly label shown in the UI, e.g. "v1.0.0".
export const VERSION_LABEL = `v${APP_VERSION}`;

// Full label including the release date, e.g. "v1.0.0 · 2026-10-05".
export const VERSION_FULL = `${VERSION_LABEL} · ${BUILD_DATE}`;
