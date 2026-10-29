/*
 * LOG OUT (the menu's footer; Brad, 2026-10-29: "there is also the logout button in the main menu tab list, that needs to
 * work"). It was OkEmu.restartApp() alone - the phone's and the desktop's restart - which the web app does not have (no
 * desktop bridge): the button did nothing there. Now, on every shell: the opened bucket closed, the key's identity
 * forgotten, a login this tab kept ended (webSession.ts), then the app started again its shell's way - the phone and the
 * desktop restart their process (the soft key boots locked: MainApp's note at the button), the web app reloads its page
 * (back to the splash and the login). A hard key keeps its own unlocked state: nothing here can lock it.
 */
import {closeBucket} from './bucketStore';
import {endSession} from './webSession';
import {shell} from './platform';
import {OkEmu} from './transport/OkEmu';

declare const location: any;

export async function logOut(): Promise<void> {
  closeBucket();
  await endSession('log out').catch(() => undefined);
  if (shell === 'webapp') {
    location.reload();
    return;
  }
  await OkEmu.restartApp();
}
