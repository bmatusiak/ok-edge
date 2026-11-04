/* the key's lock-after, MINUTES (idle-relogin.yaml): the key locks and restarts itself that long after its last activity */
const minutes = String(Math.max(1, parseInt(typeof MINUTES === 'undefined' ? '1' : MINUTES, 10) || 1));
const r = await drive.machine('cli', drive.app.shell, { argv: ['idletimeout', minutes] });
if (!r.ok) throw new Error(`the lock-after (${minutes} min) was not set: ${r.why}`);
drive.say(`the key locks itself after ${minutes} min idle`);
