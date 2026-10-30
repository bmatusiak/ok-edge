/*
 * HOW LONG A SECRET STAYS VISIBLE - once, for every screen (it was defined in six of them: CryptoScreen, SlotEditorScreen,
 * KeyChainScreen, VaultList, Passwords, Guest Book; PROPOSAL-rectify-ok-edge.md, large files).
 */

/**
 * How long a copied secret stays on the clipboard.
 *
 * Long enough to switch apps and paste, short enough that it is not still there an hour later. The clearing happens
 * natively so it survives a JS reload; see specs/NativeSecrets.ts.
 */
export const CLIPBOARD_TTL_MS = 45000;

/**
 * How long a revealed value stays on screen.
 *
 * Bounded rather than left to a toggle, because the failure mode of a toggle is walking away from a phone showing a
 * password. Long enough to read one out or check it, short enough that it is gone before the screen is put down.
 *
 * THE PLAN WANTED A DEVICE BUTTON PRESS HERE and the device cannot give one. On an unlocked OnlyKey every press runs
 * gen_press() and TYPES A SLOT (OnlyKey.ino:936-941), so there is no press that means only "yes, I am here" - asking
 * for one would type a password into the keystroke stream every time somebody wanted to look at a different one. See
 * FINDING-no-side-effect-free-confirmation-press.md.
 */
export const REVEAL_MS = 15000;
