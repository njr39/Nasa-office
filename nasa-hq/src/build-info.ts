declare const __BUILD__: { commit: string; dirty: boolean; builtAt: string } | undefined;
/** Stamped by build.mjs from git at build time. "dev" when the page is not built by it. */
export const BUILD = typeof __BUILD__ === 'undefined' ? { commit: 'dev', dirty: true, builtAt: 'unbuilt' } : __BUILD__;
export const BUILD_LABEL = `${BUILD.commit}${BUILD.dirty ? '+uncommitted' : ''}`;
