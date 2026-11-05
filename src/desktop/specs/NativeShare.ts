/*
 * FILES OUT AND IN, ON THE DESKTOP AND THE WEB APP (Brad, 2026-11-04: the backup panel needs a save button; this module
 * was an empty stub, so every save - the backup, the passwords export, the guest book - failed "not on the desktop").
 * In the page, as the classic OnlyKey App saved its backup (a Blob and FileSaver): a download, which Electron and every
 * browser answer with the person's own "Save As" - nothing is written without them choosing where. The phone's share
 * sheet has no desktop form, so shareFile is the same save. Reading a file is the page's own file chooser.
 * Asset reads stay the phone's (module.ts: not on the desktop).
 */
import type {Spec, PickedFile} from 'okedge-native/specs/NativeShare';
import {desktopModule} from './module';

function download(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], {type: `${mimeType};charset=utf-8`}));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* after the click has handed the bytes over; the URL is the only copy the page keeps */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* the page's file chooser: resolves on a pick, and on a cancel (the input's own "cancel" event, Chromium 113 on) */
function pick(mimeType: string): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = mimeType === 'text/plain' ? '.txt,text/plain' : mimeType;
    const none: PickedFile = {picked: false, name: '', content: ''};
    input.addEventListener('cancel', () => resolve(none));
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(none);
      file.text().then(content => resolve({picked: true, name: file.name, content}), reject);
    });
    input.click();
  });
}

export default desktopModule<Spec>('NativeShare', {
  saveFile: async (filename: string, content: string, mimeType: string) => {
    download(filename, content, mimeType);
    return {saved: true, name: filename};
  },
  shareFile: async (filename: string, content: string, mimeType: string) => {
    download(filename, content, mimeType);
    return true;
  },
  /* nothing is staged on the desktop: the download is the person's file */
  clearShared: async () => 0,
  pickTextFile: (mimeType: string) => pick(mimeType),
}, []);
