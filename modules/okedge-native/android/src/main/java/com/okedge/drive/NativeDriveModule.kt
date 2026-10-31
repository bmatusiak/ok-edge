package com.okedge.drive

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.EditText
import android.widget.TextView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.okrn.specs.NativeDriveSpec
import java.io.ByteArrayOutputStream

/**
 * THE ANDROID APP'S EYES FOR A DRIVE (specs/NativeDrive.ts, PROPOSAL-drive.md): its own picture, its screen's text, and
 * an event on each change of its layout - so the drive server sees the phone the way it sees the desktop and web app,
 * from the app itself, with no adb screencap or uiautomator dump.
 *
 * ok-edge's own module (not one of ok-rn's copies). Called only from src/drive, inside the drive's debugging gate.
 */
class NativeDriveModule(private val reactContext: ReactApplicationContext) : NativeDriveSpec(reactContext), LifecycleEventListener {

  private val main = Handler(Looper.getMainLooper())

  override fun getName() = NAME

  /*
   * PixelCopy of the window: what is actually drawn, the way a person sees it (a view's draw() misses surfaces and
   * hardware layers). A window with FLAG_SECURE copies as an error - said, not sent as a black picture.
   */
  override fun capture(promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NO_ACTIVITY", "the app has no window on screen")
    main.post {
      val window = activity.window
      val view = window.decorView
      if (view.width == 0 || view.height == 0) return@post promise.reject("NO_SIZE", "the window is not laid out")
      val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
      PixelCopy.request(window, bitmap, { result ->
        if (result != PixelCopy.SUCCESS) {
          bitmap.recycle()
          promise.reject("COPY_FAILED", "PixelCopy failed ($result) - a secure screen (FLAG_SECURE) copies as an error")
          return@request
        }
        Thread {
          val out = ByteArrayOutputStream()
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
          bitmap.recycle()
          promise.resolve(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
        }.start()
      }, main)
    }
  }

  /* every visible TextView's text in tree order (React Native draws Text as TextViews); EditText - a field - is skipped */
  override fun screenText(promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.resolve("")
    main.post {
      pending = false
      val lines = ArrayList<String>()
      collect(activity.window.decorView, lines)
      promise.resolve(lines.joinToString("\n"))
    }
  }

  /*
   * ONLY TEXT A PERSON SEES (2026-10-31, the Pixel's first drive: the login screen's "Log in" and "Enter testing mode"
   * were still read under the Testing tab, so the login flow kept judging "the login screen" and waited out its
   * watchdog). The rule is Android's own, the one its accessibility (and uiautomator) uses: a text counts when its node
   * is visible to the user, no parent hides it from accessibility, and its alpha (with its parents') is above zero. (A
   * home-made "on top at its centre" test came first and read nothing at all on the setup screen - replaced.)
   */
  private fun collect(v: View, lines: MutableList<String>, alpha: Float = 1f) {
    if (!v.isShown) return
    /*
     * a screen the navigator keeps attached but not shown is marked hidden from accessibility (react-native-screens'
     * inactive screen) - what Android's own accessibility (uiautomator) leaves out, so does this (2026-10-31: the
     * login screen's texts stayed in the tree under the Testing tab, and uiautomator did not list them)
     */
    if (v.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS) {
      android.util.Log.d("okedge-drive", "hidden subtree: ${v.javaClass.name} ${v.width}x${v.height} children=${(v as? ViewGroup)?.childCount ?: 0} parent=${(v.parent as? View)?.javaClass?.name}")
      return
    }
    val a = alpha * v.alpha
    if (a <= 0.01f) return
    if (v is EditText) return
    if (v is TextView) {
      val r = Rect()
      if (v.getGlobalVisibleRect(r) && r.width() > 0 && r.height() > 0 && v.createAccessibilityNodeInfo().isVisibleToUser) {
        val t = v.text?.toString()?.trim()
        if (!t.isNullOrEmpty()) lines.add(t)
      }
      return
    }
    if (v is ViewGroup) for (i in 0 until v.childCount) collect(v.getChildAt(i), lines, a)
  }

  /*
   * THE SCREEN CHANGED - an event, not a poll: the window's global layout listener fires when views are added, removed
   * or resized (new text, a sheet opening). One event waits at a time; screenText() clears it, so a burst of layouts is
   * one read. The listener follows the activity: re-attached when the app comes back to the front.
   */
  @Volatile private var pending = false
  private var watching = false
  private var watchedView: View? = null
  private val onLayout = ViewTreeObserver.OnGlobalLayoutListener {
    if (pending) return@OnGlobalLayoutListener
    pending = true
    reactContext.emitDeviceEvent(EVENT, null)
  }

  override fun watchScreen(on: Boolean) {
    main.post {
      watching = on
      if (on) { reactContext.addLifecycleEventListener(this); attach(reactContext.currentActivity) }
      else { reactContext.removeLifecycleEventListener(this); detach() }
    }
  }

  private fun attach(activity: Activity?) {
    val view = activity?.window?.decorView ?: return
    if (watchedView === view) return
    detach()
    view.viewTreeObserver.addOnGlobalLayoutListener(onLayout)
    watchedView = view
    pending = false
    reactContext.emitDeviceEvent(EVENT, null)
  }

  private fun detach() {
    watchedView?.viewTreeObserver?.let { if (it.isAlive) it.removeOnGlobalLayoutListener(onLayout) }
    watchedView = null
  }

  override fun onHostResume() { if (watching) attach(reactContext.currentActivity) }
  override fun onHostPause() {}
  override fun onHostDestroy() { detach() }

  override fun invalidate() {
    main.post { detach() }
    super.invalidate()
  }

  companion object {
    const val NAME = NativeDriveSpec.NAME
    const val EVENT = "okedgeDriveScreen"
  }
}
