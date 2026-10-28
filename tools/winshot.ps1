# A screenshot of one window on Windows, by its process name - PrintWindow (the window draws itself into the image), so
# nothing is clicked, nothing comes to the front and a window behind others is still captured whole.
#   powershell -File tools/winshot.ps1 -Name ok-edge -Out shot.png
param([string]$Name = 'ok-edge', [string]$Out = 'winshot.png')
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class W {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
}
'@
$p = Get-Process -Name $Name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Error "no window of a process named $Name"; exit 1 }
$r = New-Object W+RECT
[void][W]::GetWindowRect($p.MainWindowHandle, [ref]$r)
$bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$dc = $g.GetHdc()
# 2 = PW_RENDERFULLCONTENT: Chromium's window draws through the GPU, which the plain PrintWindow leaves black
[void][W]::PrintWindow($p.MainWindowHandle, $dc, 2)
$g.ReleaseHdc($dc)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
"$Out ($($bmp.Width)x$($bmp.Height)) - $($p.MainWindowTitle)"
