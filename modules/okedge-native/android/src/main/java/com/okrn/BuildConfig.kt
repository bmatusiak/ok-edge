package com.okrn

/*
 * The copied modules read com.okrn.BuildConfig (ok-rn's app BuildConfig) - NativeUsbHidModule picks
 * the TCP transport only on a debug build in an emulator. Here they live in a library, whose own
 * BuildConfig is com.okedge.nativemods.BuildConfig; this forwards to it so the copies stay byte
 * copies of ok-rn's. A library built into a release app is built as release, so DEBUG matches.
 */
object BuildConfig {
  @JvmField val DEBUG: Boolean = com.okedge.nativemods.BuildConfig.DEBUG
}
