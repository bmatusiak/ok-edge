/*
 * THE LOCAL MCP, ON ITS OWN (the mcp-server Rectify app in Node - mcp-core + mcp-localhost): for the server tests and a
 * machine without the desktop app. The desktop app composes the same two plugins in Electron's main process.
 *   node mcp-server/src/localhost/main.js [--port 8790] [--var KEY=VALUE ...]
 *   e.g. --var REQUIRE_LOGIN=0 for the server tests' kept-certificate joins
 */
import Rectify from '@bmatusiak/rectify';
import core from '../core/plugin.js';
import localhost from './plugin.js';

const args = process.argv.slice(2);
const at = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const env = {};
for (let i = 0; i < args.length; i++) if (args[i] === '--var') { const [k, ...v] = String(args[i + 1] || '').split('='); env[k] = v.join('='); }

const app = Rectify.build([core, localhost]);
await app.start();
const s = await app.services.mcpLocalhost.start({ port: Number(at('--port') || 8790), env });
console.log(`local MCP ready on ${s.url}`);
