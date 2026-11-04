/*
 * THIS BUILD'S CHANNEL (Brad, 2026-11-04: two apps - the published release, and the debug build "to install at will";
 * modules/okedge-native/app.plugin.js): EXPO_PUBLIC_OKEDGE_CHANNEL, inlined by Metro from the same variable Gradle reads -
 * 'release' for a published release, anything else 'debug' (local builds and pre-releases). It picks the site this
 * build's update notices ask (appUpdate.ts): a release asks the published site, which follows releases only; a debug
 * build asks the pre-release site, whose builds are debug ones too.
 */
export type Channel = 'release' | 'debug';
export const CHANNEL: Channel = process.env.EXPO_PUBLIC_OKEDGE_CHANNEL === 'release' ? 'release' : 'debug';
export const UPDATE_SITE = CHANNEL === 'release' ? 'https://ok-edge.bmatusiak.workers.dev' : 'https://ok-edge-pre-release.bmatusiak.workers.dev';
