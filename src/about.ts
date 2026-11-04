/*
 * WHAT THIS APP IS AND WHAT IT USES (tools/legal/gen-about.js writes src/generated/about.json at bundle time, from
 * metro.config.js): its version and commit, its library's, the licenses, the contributors and every package it carries.
 * require() in a try/catch, as buildInfo's firmware.json: a bundle made without the generator says so, never a guess.
 */
export type About = {
  app: {name: string; version: string; commit: string; license: string; notice: string};
  library: {name: string; version: string; commit: string; license: string};
  contributors: string[];
  source: {what: string; where: string}[];
  firmware: {acknowledgment: string; license: string; libraries: string};
  apache: string;
  packages: {name: string; version: string; license: string}[];
};

let loaded: About | null = null;
try {
  loaded = require('./generated/about.json') as About;
} catch {
  loaded = null;
}
export const about: About | null = loaded;
