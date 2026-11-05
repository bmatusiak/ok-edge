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
      /* what the screen looked like as read: a frame that looks the same asks nothing (check) */
      lastRead = look(activity.window.decorView)
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
    if (v.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS) return
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
   * WHAT THE SCREEN LOOKS LIKE, CHEAPLY (no accessibility nodes - this runs on every frame drawn): each text with where it
   * is and its alpha, and where a hidden branch stops the walk. A fade, a slide or a text changed in place all change it.
   */
  private fun look(root: View): String {
    val sb = StringBuilder()
    fun walk(v: View, alpha: Float) {
      if (!v.isShown) return
      if (v.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS) { sb.append("h,"); return }
      val a = alpha * v.alpha
      if (a <= 0.01f) { sb.append(a).append(','); return }
      if (v is EditText) return
      if (v is TextView) {
        val p = IntArray(2)
        v.getLocationOnScreen(p)
        sb.append(v.text).append('@').append(p[0]).append(':').append(p[1]).append('^').append(a).append('\u0000')
        return
      }
      if (v is ViewGroup) for (i in 0 until v.childCount) walk(v.getChildAt(i), a)
    }
    walk(root, 1f)
    return sb.toString()
  }

  /*
   * THE SCREEN CHANGED - an event, not a poll: the window's global layout listener fires when views are added, removed
   * or resized (new text, a sheet opening). One event waits at a time; screenText() clears it, so a burst of layouts is
   * one read. The listener follows the activity: re-attached when the app comes back to the front.
   */
  /*
   * ...AND ON EVERY FRAME THAT LOOKS DIFFERENT (the Pixel, 2026-11-05 - three misses of the restore's "Choose a PIN": the
   * page faded in (read at alpha 0), slid in (read off the screen), and changed its words in place once the key came up
   * (no layout at all) - and each time nothing asked again, and the drive waited out its watchdog on a page that was
   * plainly there). A "settling" guess after each layout missed the last case. Now each frame drawn checks how the screen
   * looks (look(), cheap) against the last read, one check at a time, and only a difference is an event. A still screen
   * draws nothing; a spinner draws, looks the same and asks nothing. The drive runs in debug builds only.
   */
  @Volatile private var pending = false
  private var checking = false
  private var lastRead: String? = null
  private var watching = false
  private var watchedView: View? = null
  private fun changed() {
    if (pending) return
    pending = true
    reactContext.emitDeviceEvent(EVENT, null)
  }
  private fun check() {
    if (pending || checking) return
    val root = watchedView ?: return
    checking = true
    main.post {
      checking = false
      if (!pending && look(root) != lastRead) changed()
    }
  }
  private val onLayout = ViewTreeObserver.OnGlobalLayoutListener { changed() }
  private val onDraw = ViewTreeObserver.OnDrawListener { check() }

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
    view.viewTreeObserver.addOnDrawListener(onDraw)
    watchedView = view
    pending = false
    reactContext.emitDeviceEvent(EVENT, null)
  }

  private fun detach() {
    watchedView?.viewTreeObserver?.let { if (it.isAlive) { it.removeOnGlobalLayoutListener(onLayout); it.removeOnDrawListener(onDraw) } }
    watchedView = null
  }

  override fun onHostResume() { if (watching) attach(reactContext.currentActivity) }
  override fun onHostPause() {}
  override fun onHostDestroy() { detach() }

  /*
   * THE APP'S OWN LOGCAT (Brad, 2026-10-31: "test-moniker did some logcat tricks ... pull logcat into the drive server
   * for the app process"): test-moniker follows `adb logcat --pid <the app>` from the host; an app may read its own
   * process's log with no permission and no adb, so the app does it (the drive's rule: the app gives its own events).
   * Each line is an "okedgeDriveLog" event, from now on (-T 1), in logcat's time format. The JS console's own lines
   * (ReactNativeJS, "I/ReactNativeJS(") are left out - the drive has those already. The JS side decides what may leave the phone.
   */
  private var logcat: Process? = null

  override fun watchLog(on: Boolean) {
    logcat?.destroy()
    logcat = null
    if (!on) return
    val p = try {
      ProcessBuilder("logcat", "-v", "time", "-T", "1", "--pid=${android.os.Process.myPid()}").redirectErrorStream(true).start()
    } catch (e: Exception) {
      reactContext.emitDeviceEvent(LOG_EVENT, "[logcat] could not start: ${e.message}")
      return
    }
    logcat = p
    Thread({
      try {
        p.inputStream.bufferedReader().forEachLine { l ->
          if (!l.contains("/ReactNativeJS") && !l.startsWith("--------- beginning of")) reactContext.emitDeviceEvent(LOG_EVENT, l)
        }
      } catch (_: Exception) { /* destroyed: watchLog(false) or the module going */ }
    }, "okedge-drive-logcat").apply { isDaemon = true }.start()
  }

  override fun invalidate() {
    main.post { detach() }
    logcat?.destroy()
    logcat = null
    super.invalidate()
  }

  companion object {
    const val NAME = NativeDriveSpec.NAME
    const val EVENT = "okedgeDriveScreen"
    const val LOG_EVENT = "okedgeDriveLog"
  }
}
