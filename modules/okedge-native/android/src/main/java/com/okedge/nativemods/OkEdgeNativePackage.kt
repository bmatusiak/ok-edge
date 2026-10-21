package com.okedge.nativemods

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.okrn.kdf.NativeKdfModule
import com.okrn.okssl.NativeOkSslModule
import com.okrn.random.NativeRandomModule
import com.okrn.rsagen.NativeRsaGenModule
import com.okrn.secrets.NativeSecretsModule
import com.okrn.specs.NativeKdfSpec
import com.okrn.specs.NativeOkSslSpec
import com.okrn.specs.NativeRandomSpec
import com.okrn.specs.NativeRsaGenSpec
import com.okrn.specs.NativeSecretsSpec
import com.okrn.specs.NativeUsbHidSpec
import com.okrn.specs.NativeOkEmuSpec
import com.okrn.emu.NativeOkEmuModule
import com.okrn.specs.NativeFidoGattSpec
import com.okrn.fido.NativeFidoGattModule
import com.okrn.specs.NativeEdgeAlertSpec
import com.okrn.emu.NativeEdgeAlertModule
import com.okrn.specs.NativeShareSpec
import com.okrn.share.NativeShareModule
import com.okrn.specs.NativeBtKeyboardSpec
import com.okrn.btkbd.NativeBtKeyboardModule
import com.okrn.specs.NativeContactLinkSpec
import com.okrn.contact.NativeContactLinkModule
import com.okrn.specs.NativeCredProviderSpec
import com.okrn.credprovider.NativeCredProviderModule
import com.okrn.specs.NativeQrScannerSpec
import com.okrn.qr.NativeQrScannerModule
import com.okrn.specs.NativeAppSignatureSpec
import com.okrn.sig.NativeAppSignatureModule
import com.okrn.usb.NativeUsbHidModule

/*
 * The modules this library holds, registered the way ok-rn's OkRnPackage registers them: the
 * module classes are byte copies of ok-rn's (package com.okrn.*, so a diff against the oracle
 * stays exact); only this list is ok-edge's own. Autolinking adds it to the app
 * (react-native.config.js).
 */
class OkEdgeNativePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      NativeRandomSpec.NAME -> NativeRandomModule(reactContext)
      NativeKdfSpec.NAME -> NativeKdfModule(reactContext)
      NativeOkSslSpec.NAME -> NativeOkSslModule(reactContext)
      NativeRsaGenSpec.NAME -> NativeRsaGenModule(reactContext)
      NativeSecretsSpec.NAME -> NativeSecretsModule(reactContext)
      NativeUsbHidSpec.NAME -> NativeUsbHidModule(reactContext)
      NativeOkEmuSpec.NAME -> NativeOkEmuModule(reactContext)
      NativeFidoGattSpec.NAME -> NativeFidoGattModule(reactContext)
      NativeEdgeAlertSpec.NAME -> NativeEdgeAlertModule(reactContext)
      NativeShareSpec.NAME -> NativeShareModule(reactContext)
      NativeBtKeyboardSpec.NAME -> NativeBtKeyboardModule(reactContext)
      NativeContactLinkSpec.NAME -> NativeContactLinkModule(reactContext)
      NativeCredProviderSpec.NAME -> NativeCredProviderModule(reactContext)
      NativeQrScannerSpec.NAME -> NativeQrScannerModule(reactContext)
      NativeAppSignatureSpec.NAME -> NativeAppSignatureModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(NativeRandomSpec.NAME, NativeKdfSpec.NAME, NativeOkSslSpec.NAME, NativeRsaGenSpec.NAME, NativeSecretsSpec.NAME,
      NativeUsbHidSpec.NAME, NativeOkEmuSpec.NAME, NativeFidoGattSpec.NAME, NativeEdgeAlertSpec.NAME, NativeShareSpec.NAME,
      NativeBtKeyboardSpec.NAME, NativeContactLinkSpec.NAME, NativeCredProviderSpec.NAME, NativeQrScannerSpec.NAME,
      NativeAppSignatureSpec.NAME)
      .associateWith { ReactModuleInfo(it, it, false, false, false, true) }
  }
}
