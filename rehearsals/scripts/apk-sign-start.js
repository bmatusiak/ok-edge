/*
 * THE APK SIGNER STARTS BESIDE THE FLOW (the signing dry run, plan B7): the identity public key the Edge tab gives an
 * agent, then tools/release/apk-sign/sign.js on the app's own machine (the drive's apk-sign action) - its card, then the
 * APK - against this desktop's local MCP (SERVER=local, as on Brad's PC) or the stand-in (SERVER=standin, the workflow's
 * remote path). Not awaited here: the flow accepts the agent and approves its card and its plan; apk-sign-end.js takes
 * the verdict. The test key's SLOT (2) holds the debug keystore's key, so the APK must verify with the debug certificate.
 */
const identity = (drive.app.text.match(/\b[0-9a-f]{64}\b/) || [])[0];
if (!identity) throw new Error('the Edge tab shows no identity public key - is a bucket open and the Agents rows on screen?');
/* a name of this run's own: the flow accepts this agent and approves its card, never another's */
output.agentName = `apk-sign-${Date.now().toString(36)}`;
const server = String(typeof SERVER === 'undefined' ? 'local' : SERVER);
const slot = Number(typeof SLOT === 'undefined' ? 2 : SLOT);
drive.say(`the signer ${output.agentName} for identity ${identity.slice(0, 12)}… over ${server}, slot ${slot}`);
output.__apkSign = drive.machine('apk-sign', drive.app.shell, { identity, name: output.agentName, server, slot })
  .catch((e) => ({ ok: false, why: e.message }));
