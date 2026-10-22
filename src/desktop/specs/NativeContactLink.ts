/* Guest Book's okrn:// links: the phone's, absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeContactLink';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeContactLink', {}, ["onContactLink"]);
