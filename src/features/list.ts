/*
 * WHICH TABS A PLATFORM HAS - one file per platform, picked by the build (PROPOSAL-rectify-ok-edge.md rule 2; Metro
 * takes list.android.ts / list.web.ts, the desktop build list.desktop.ts). This file is what TypeScript and Jest see:
 * the web app's list.
 */
export * from './list.web';
