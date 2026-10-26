// A stand-in until mcp-server/ exists: serve ok-edge/docs over HTTPS as apps.crp.to (the box's dev cert).
// node serve-docs.js <docsDir> <certDir> [port]
const https = require('https');
const fs = require('fs');
const path = require('path');
const [docs, certs, port = '8443'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.map': 'application/json' };
https.createServer({ key: fs.readFileSync(path.join(certs, 'apps.crp.to.key')), cert: fs.readFileSync(path.join(certs, 'apps.crp.to.crt')) }, (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'https://x').pathname);
  let f = path.join(docs, p);
  if (!f.startsWith(path.resolve(docs))) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(docs, 'index.html'); /* single-page app */
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(Number(port), () => console.log(`serving ${docs} at https://apps.crp.to:${port}`));
