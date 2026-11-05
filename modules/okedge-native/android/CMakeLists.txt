cmake_minimum_required(VERSION 3.22.1)
project(okssl C CXX)

# OKSSL_OPENSSL: the release AAR's prefab/modules/openssl (build.gradle fetches,
# checks and unpacks it). libcrypto is linked statically: only what okssl.cpp
# calls ends up in libokssl.so.
if(NOT OKSSL_OPENSSL)
  message(FATAL_ERROR "OKSSL_OPENSSL is not set - build through Gradle (okssl/build.gradle)")
endif()

add_library(okssl_crypto STATIC IMPORTED)
set_target_properties(okssl_crypto PROPERTIES
  IMPORTED_LOCATION ${OKSSL_OPENSSL}/libs/android.${ANDROID_ABI}/libcrypto.a)

add_library(okssl SHARED src/main/cpp/okssl.cpp)
target_include_directories(okssl PRIVATE ${OKSSL_OPENSSL}/include)
target_compile_features(okssl PRIVATE cxx_std_17)
target_link_libraries(okssl okssl_crypto log)
# 16 KB PAGES (Android 15+; Google Play requires it for new apps from Nov 2025): the library's segments aligned to
# 16 KB, so it loads on a phone whose kernel runs 16 KB pages. NDK r27 still links 4 KB by default (r28 does this
# itself) - the APK's other libraries already were; this one was 0x1000 (llvm-readelf -l, 2026-11-05).
target_link_options(okssl PRIVATE -Wl,-z,max-page-size=16384)
# Hide everything but the JNI entry points.
set_target_properties(okssl PROPERTIES CXX_VISIBILITY_PRESET hidden)
target_link_options(okssl PRIVATE -Wl,--exclude-libs,ALL -Wl,--gc-sections)
