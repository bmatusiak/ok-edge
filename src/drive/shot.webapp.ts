/*
 * THE WEB APP'S PICTURE OF ITSELF (shot.ts; Brad, 2026-10-31: "have the app do it, not the drive server"). A page cannot
 * screenshot itself without asking the person each time (getDisplayMedia), so it draws itself: a copy of its DOM with
 * every element's computed style written inline, inside an SVG foreignObject, painted onto a canvas and taken as PNG.
 * What it cannot copy - a cross-origin image, a canvas's pixels - stays blank; text, boxes and colours are the page's
 * own. Fields are drawn empty: a typed PIN or passphrase never leaves the page (the screen text's rule).
 */
export async function shot(): Promise<{png: string} | {why: string}> {
  try {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const clone = document.body.cloneNode(true) as HTMLElement;
    inline(document.body, clone);
    for (const f of Array.from(clone.querySelectorAll('input, textarea')) as (HTMLInputElement | HTMLTextAreaElement)[]) {
      f.setAttribute('value', '');
      f.textContent = '';
    }
    clone.style.margin = '0';
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;background:${getComputedStyle(document.body).backgroundColor}">${xhtml}</div>`
      + '</foreignObject></svg>';
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return {why: 'no 2d canvas in this browser'};
    g.drawImage(img, 0, 0);
    return {png: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')};
  } catch (e) {
    return {why: `the page could not draw itself: ${String((e as Error)?.message ?? e)}`};
  }
}

/* every element's computed style, written on its copy - the page's stylesheets do not travel into the picture */
function inline(from: Element, to: Element): void {
  const cs = getComputedStyle(from);
  let css = '';
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i];
    css += `${p}:${cs.getPropertyValue(p)};`;
  }
  (to as HTMLElement).setAttribute('style', css);
  const a = from.children;
  const b = to.children;
  for (let i = 0; i < a.length && i < b.length; i++) inline(a[i], b[i]);
}
