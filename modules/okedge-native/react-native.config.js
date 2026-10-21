/* Android only (no iOS in ok-edge). The package class registers every module this library holds. */
module.exports = {
  dependency: {
    platforms: {
      ios: null,
      android: {
        packageImportPath: 'import com.okedge.nativemods.OkEdgeNativePackage;',
        packageInstance: 'new OkEdgeNativePackage()',
      },
    },
  },
};
