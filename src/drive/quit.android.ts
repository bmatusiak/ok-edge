/* THE ANDROID APP CLOSES ITSELF (quit.ts): its activity finishes, as the back button's exit would */
import {BackHandler} from 'react-native';

export async function quit(): Promise<{ok: true} | {why: string}> {
  setTimeout(() => BackHandler.exitApp(), 300); /* after the reply is out */
  return {ok: true};
}
