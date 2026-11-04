package com.okrn.sig

import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.okrn.BuildConfig
import com.okrn.specs.NativeAppSignatureSpec
import java.security.MessageDigest

/**
 * Which certificate signed the running APK, and whether it is an official one
 * (specs/NativeAppSignature.ts says why).
 *
 * apkContentsSigners is the certificate the APK is signed with NOW - after a key
 * rotation that is the newest one in the lineage, which is the one to compare.
 * The official one comes from the build (BuildConfig.OKEDGE_OFFICIAL_SIGNER: the
 * SHA-256 of signing/release.crt.pem, red-key's RSA3 certificate - this module's
 * build.gradle). None pinned: nothing is official.
 */
class NativeAppSignatureModule(reactContext: ReactApplicationContext) :
  NativeAppSignatureSpec(reactContext) {

  override fun getName() = NAME

  private val signers: List<String> by lazy { readSigners() }

  override fun signerSha256(): String = signers.firstOrNull() ?: ""

  /* every signer must be official: an APK with an extra, unknown signer is not ours */
  override fun isOfficial(): Boolean {
    val official = BuildConfig.OKEDGE_OFFICIAL_SIGNER.uppercase()
    return official.isNotEmpty() && signers.isNotEmpty() && signers.all { it == official }
  }

  private fun readSigners(): List<String> = try {
    val pm = reactApplicationContext.packageManager
    val name = reactApplicationContext.packageName
    val certs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      pm.getPackageInfo(name, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo?.apkContentsSigners
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(name, PackageManager.GET_SIGNATURES).signatures
    }
    (certs ?: emptyArray()).map { sig ->
      MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).joinToString(":") { "%02X".format(it) }
    }
  } catch (e: Exception) {
    emptyList()
  }

  companion object {
    const val NAME = NativeAppSignatureSpec.NAME
  }
}
