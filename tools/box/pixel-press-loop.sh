#!/usr/bin/env bash
# Answer every press sheet ok-edge raises on the Pixel for <seconds>: wait for the app's "[press] sheet up ... button at
# X,Y" line, give the sheet 1.5 s to settle (a tap during its slide-in lands nowhere), tap the button there, and say so.
# For the TESTNET soft key in testing mode only - the presses are the developer's to give there (never a live key).
#   bash tools/box/pixel-press-loop.sh 90            then reads the app's [press]/[card]/[identity] lines
export ANDROID_SERIAL=${ANDROID_SERIAL:-26251JEGR09693} PATH=$PATH:$HOME/Android/Sdk/platform-tools
SECS=${1:-60}
end=$(( $(date +%s) + SECS ))
seen=0
while [ "$(date +%s)" -lt "$end" ]; do
  n=$(adb logcat -d | grep -c "\[press\] sheet up")
  if [ "$n" -gt "$seen" ]; then
    xy=$(adb logcat -d | grep -o "sheet up: .* button at [0-9]*,[0-9]*" | tail -1 | grep -o "[0-9]*,[0-9]*$")
    sleep 1.5
    adb shell input tap "${xy%,*}" "${xy#*,}"
    echo "$(date +%T) tapped the press sheet at $xy"
    seen=$n
  fi
  sleep 0.5
done
adb logcat -d | grep ReactNativeJS | grep -E "\[press\] tap|\[card\]|\[identity\]|login" | cut -c33-230 | tail -20
