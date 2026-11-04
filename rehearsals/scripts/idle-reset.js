/* the key's lock-after back to the firmware's default (30 min) after idle-relogin.yaml */
const r = await drive.machine('cli', drive.app.shell, { argv: ['idletimeout', '30'] });
if (!r.ok) throw new Error(`the lock-after was not put back to 30 min: ${r.why}`);
drive.say('the lock-after is back to 30 min');
