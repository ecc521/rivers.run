# Temporary Migration Code Tracking

This file tracks one-time migrations and compatibility logic that should eventually be removed to keep the codebase clean.

## [2026-04-09] LocalStorage to Capacitor Preferences Migration

### Purpose
`localStorage` is unreliable for persistent data in hybrid/mobile environments as it can be purged by the OS or when browsing data is cleared. `@capacitor/preferences` provides a stable, native persistence layer.

### Implementation Details
- **Migration Logic**: Located in `src/utils/persistentStorage.ts` under the `migrate()` function.
- **Affected Keys**: 
    - `userTheme`
    - `colorBlindMode`
    - `homePageDefaultSearch`
    - `rivers_favorites`
    - `rivers_favorites_last_modified`
    - Any other `rivers_*` related settings.
- **Cleanup**: The migration logic explicitly calls `localStorage.removeItem(key)` after successfully copying a value to Preferences.

### Removal Criteria
- This migration code can be safely removed once we are confident that the majority of active users have opened the app at least once after this update (e.g., in 6-12 months).
- Since this is a critical data reliability fix, we should keep it until we move to a version where we no longer support legacy `localStorage` fallback.

---
*Created by Antigravity AI*
