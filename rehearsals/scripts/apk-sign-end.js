/* the signer's own verdict (apk-sign-start.js): the APK signed and verified with the certificate - its last lines said */
const r = output.__apkSign ? await output.__apkSign : { ok: false, why: 'no signer was started (apk-sign-start.js)' };
output.__apkSign = null;
if (!r.ok) throw new Error(`the signer: ${r.why}`);
if (!/signed \(v2 \+ v3\) by the certificate [0-9a-f]{64}/.test(r.what)) throw new Error(`the signer ended without a verified APK: ${r.what}`);
drive.say(`the signer: ${r.what}`);
