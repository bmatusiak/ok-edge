/*
 * THE LOCAL MCP, ON ITS OWN (the mcp-server Rectify app in Node - mcp-core + mcp-localhost): for the server tests and a
 * machine without the desktop app. The desktop app composes the same two plugins in Electron's main process.
 *   node mcp-server/src/localhost/main.js [--port 8790] [--host 127.0.0.1] [--var KEY=VALUE ...]
 *     [--assets docs] [--tls-key k.pem --tls-cert c.pem] [--sealed]
 *   e.g. --var REQUIRE_LOGIN=0 for the server tests' kept-certificate joins; the web app on the box (as the key's site,
 *   the dev certificate, the sealed copy): --assets docs --tls-key .../apps.crp.to.key --tls-cert .../apps.crp.to.crt --sealed
 */
import fs from 'node:fs';
import Rectify from '@bmatusiak/rectify';
import core from '../core/plugin.js';
import localhost from './plugin.js';

const args = process.argv.slice(2);
const at = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const env = {};
for (let i = 0; i < args.length; i++) if (args[i] === '--var') { const [k, ...v] = String(args[i + 1] || '').split('='); env[k] = v.join('='); }

const app = Rectify.build([core, localhost]);
await app.start();
const tls = at('--tls-key') ? { key: fs.readFileSync(at('--tls-key')), cert: fs.readFileSync(at('--tls-cert')) } : null;
const s = await app.services.mcpLocalhost.start({
  host: at('--host') || '127.0.0.1', port: Number(at('--port') || 8790), env, assets: at('--assets') || null, tls, sealed: args.includes('--sealed'),
});
console.log(`local MCP ready on ${s.url}`);
