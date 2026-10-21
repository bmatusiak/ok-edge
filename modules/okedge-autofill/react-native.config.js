/* Android only. A plain native module (NativeModules.OkAutofill), registered as ok-rn's MainApplication does. */
module.exports = {
  dependency: {
    platforms: {
      ios: null,
      android: {
        packageImportPath: 'import com.okrn.autofill.AutofillPackage;',
        packageInstance: 'new AutofillPackage()',
      },
    },
  },
};
