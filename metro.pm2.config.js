/*
 * ok-edge's Metro under pm2, beside ok-rn's (ok-rn/metro.pm2.config.js has the full notes):
 * port 8082, so ok-rn's ok-rn-metro keeps 8081. A debug build asks for 8082 (app.plugin.js sets
 * reactNativeDevServerPort); on the phone, `adb reverse tcp:8082 tcp:8082`.
 *
 *   pm2 start metro.pm2.config.js     start (or: pm2 restart ok-edge-metro)
 *   pm2 logs ok-edge-metro            watch it
 *   pm2 stop ok-edge-metro            stop it
 *
 * Expo's CLI, not react-native's: an Expo build asks Metro for Expo's own entry. As in ok-rn:
 * package.json and package-lock.json are watched (a re-pin restarts it), --max-workers 1 (no
 * console window per worker on Windows), and every start clears the transform cache.
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ok-edge-metro',
      cwd: __dirname,
      script: path.join(__dirname, 'node_modules', 'expo', 'bin', 'cli'),
      args: 'start --port 8082 --localhost --max-workers 1 --clear',
      interpreter: 'node',
      windowsHide: true,
      watch: ['package.json', 'package-lock.json'],
      watch_delay: 8000,
      autorestart: true,
    },
  ],
};
