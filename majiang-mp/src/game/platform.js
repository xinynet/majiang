/* The host side of game-core's events.
 *
 * WebAudio, navigator.vibrate and a DOM toast do not exist here, so the tones
 * the H5 build synthesised at runtime are pre-rendered wav files instead
 * (mp-tools/prep-assets.mjs generates them).
 */

const players = new Map();

export function playTone(freq) {
  const name = 't' + freq;
  try {
    let audio = players.get(name);
    if (!audio) {
      audio = uni.createInnerAudioContext();
      audio.src = `/static/sfx/${name}.wav`;
      players.set(name, audio);
    }
    audio.stop();
    audio.play();
  } catch (e) { /* a missing tone must never interrupt play */ }
}

export function vibrate() {
  try { uni.vibrateShort({ type: 'light' }); } catch (e) {}
}

export function toast(title) {
  uni.showToast({ title, icon: 'none', duration: 1500 });
}

/* game-core emits; this turns them into platform effects. The caller still gets
 * the event so it can update its own view state. */
export function createEmitter({ sound = true, haptic = true, onEvent = () => {} } = {}) {
  return (name, payload) => {
    if (name === 'sound' && sound) playTone(payload);
    else if (name === 'haptic' && haptic) vibrate();
    else if (name === 'toast') toast(payload);
    onEvent(name, payload);
  };
}

/* Canvas plumbing differs per platform; the renderer only wants a 2d context, a
 * way to load images and a way to make offscreen canvases. Mini-program canvases
 * mint their own Image and frame callbacks, browsers use the globals - detected
 * rather than compiled in, so the same page can be exercised on both. */
export function canvasHost(canvas) {
  const mpImage = typeof canvas.createImage === 'function';
  const mpFrame = typeof canvas.requestAnimationFrame === 'function';
  return {
    ctx: canvas.getContext('2d'),
    loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = mpImage ? canvas.createImage() : new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    },
    makeCanvas(w, h) {
      if (typeof uni !== 'undefined' && uni.createOffscreenCanvas) {
        return uni.createOffscreenCanvas({ type: '2d', width: w, height: h });
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    },
    frame(cb) {
      return mpFrame ? canvas.requestAnimationFrame(cb) : requestAnimationFrame(cb);
    },

    /* How many device pixels one drawing unit covers.
     *
     * Platforms disagree: a WeChat 2d canvas hands back a raw context where one
     * unit is one device pixel, while uni-app's H5 canvas has already applied a
     * dpr scale, and setTransform composes with it instead of replacing it - so
     * assuming either convention makes the board come out dpr times too big on
     * the other. Measuring sidesteps the whole question.
     */
    measureUnitScale() {
      try {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, 50, 2);
        ctx.restore();
        const row = ctx.getImageData(0, 0, canvas.width, 1).data;
        let last = -1;
        for (let i = 0; i < canvas.width; i++) {
          const p = i * 4;
          if (row[p] > 200 && row[p + 1] < 80 && row[p + 2] > 200) last = i;
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        return last >= 0 ? (last + 1) / 50 : 1;
      } catch (e) {
        return 1;
      }
    },
  };
}

/* `rect` comes back alongside `size` because a <canvas type="2d"> hands touch
 * events plain viewport coordinates, not canvas-relative ones, so the caller
 * needs the board's position on screen to convert them. */
export function queryCanvas(selector, ctxScope) {
  return new Promise(resolve => {
    uni.createSelectorQuery().in(ctxScope).select(selector).fields({ node: true, size: true, rect: true }).exec(res => {
      const found = res && res[0];
      if (found && found.node) {
        return resolve({ canvas: found.node, width: found.width, height: found.height,
                         left: found.left || 0, top: found.top || 0 });
      }
      // H5 builds hand back only a size, so reach for the element itself.
      const el = typeof document !== 'undefined' && document.querySelector(selector);
      if (el) {
        const inner = el.tagName === 'UNI-CANVAS' ? el.querySelector('canvas') : el;
        const box = el.getBoundingClientRect();
        return resolve({ canvas: inner || el, width: box.width, height: box.height, left: box.left, top: box.top });
      }
      resolve(null);
    });
  });
}

/* The board node, however the platform exposes it.
 *
 * The board is a flex child, so the first query can land before layout has given
 * it a size; laying the pile out against that would pack every tile into a
 * corner. Retry until the element reports a real box.
 *
 * A box that is merely non-zero is not enough. The top bar pads itself by the
 * status-bar height once the page has measured the system capsule, and that
 * shrinks the board underneath it - on this device by 47px out of 544. A layout
 * built against the taller box is drawn into a shorter canvas, so the pile comes
 * out squashed and every hit test is off by a growing amount down the screen.
 * Waiting for two consecutive identical measurements means the caller only ever
 * sees the box the board settles at. */
export async function resolveCanvas(selector, ctxScope, tries = 20) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const found = await queryCanvas(selector, ctxScope);
    if (found && found.width > 80 && found.height > 80) {
      if (last && last.width === found.width && last.height === found.height) return found;
      last = found;
    }
    await new Promise(r => setTimeout(r, 60));
  }
  return last || queryCanvas(selector, ctxScope);
}
