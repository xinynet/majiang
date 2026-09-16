/* Draws the whole tile pile into one 2D context.
 *
 * The DOM renderer this replaces cost one element plus four inline style writes
 * per tile per frame. In a mini-program every one of those crosses the setData
 * bridge, which will not hold 60fps at 105 tiles, so the board becomes a single
 * canvas and the pile is painted directly.
 *
 * Nothing here touches the DOM, so the same file runs against a browser canvas
 * and against <canvas type="2d"> in WeChat. Geometry comes from tile-poses.js
 * rather than being copied out of the stylesheet.
 */
import {
  samplePose, frameRect, artMatrix,
  BOX_RATIO, SHELL_INSET_X, SHELL_INSET_Y, SHELL_W, SHELL_H, ART_INSET,
} from './tile-poses.js';

const DEG = Math.PI / 180;
// Layer offsets and the lift a leaning tile gets; these mirror poseTransform() in app.js.
const LAYER_DX = -5, LAYER_DY = -9, LEAN_LIFT = 0.27;
// Contact shadow, from .baked-body in styles-v60.css. A drop-shadow blur radius is a
// standard deviation, canvas shadowBlur is about twice that.
const SHADOW_COLOR = 'rgba(25,62,51,.23)', SHADOW_BLUR = 2.4;
const contactOffset = pose => 1 + pose.z * 2 + Math.abs(pose.lean) * 0.025;

export function tilePose(t) {
  const p = t.motion ? t.motion.current : t;
  return { x: p.x, y: p.y, z: p.z, lean: (t.motion ? p.lean : t.stand) || 0 };
}

/* Where a tile's box sits, before its own spin. Hit testing and painting must
 * agree, so both go through this. */
export function tileBox(t, pose, m) {
  const w = m.w, h = w * BOX_RATIO;
  const lift = Math.abs(Math.sin(pose.lean * DEG)) * w * LEAN_LIFT;
  return {
    w, h,
    x: m.ox + pose.x * m.sx + pose.z * LAYER_DX,
    y: m.oy + pose.y * m.sy + pose.z * LAYER_DY - lift,
  };
}

export function createBoardRenderer(ctx, atlas, faceFor) {
  /* A settled tile is the same picture every frame, so it is composited once
   * into an offscreen canvas and afterwards blitted with a single drawImage.
   * Only tiles mid-fall take the full path, and there are never many of those. */
  const cache = new Map();
  let cacheW = 0;

  function paintTile(target, t, pose, w) {
    const h = w * BOX_RATIO;
    const s = samplePose(pose.lean);
    const a = frameRect(s.index);
    target.drawImage(atlas, a.sx, a.sy, a.sw, a.sh,
      -w * SHELL_INSET_X, -w * SHELL_INSET_Y, w * SHELL_W, w * SHELL_H);
    if (s.blend > 0.001) {
      const b = frameRect(s.next);
      target.globalAlpha = s.blend;
      target.drawImage(atlas, b.sx, b.sy, b.sw, b.sh,
        -w * SHELL_INSET_X, -w * SHELL_INSET_Y, w * SHELL_W, w * SHELL_H);
      target.globalAlpha = 1;
    }
    // The shadow belongs to the tile's silhouette, so it is cast by the shell
    // only; the artwork is printed on the face and must not cast anything.
    target.shadowColor = 'transparent';
    target.shadowBlur = target.shadowOffsetY = 0;
    const face = faceFor(t.type);
    if (!face) return false;
    const M = artMatrix(s.index, s.next, s.blend);
    target.save();
    target.transform(M[0], M[1], M[2], M[3], M[4] * w, M[5] * w);
    // The art is printed onto the baked shell, not laid over it, so the shell's
    // highlights and the red back seam still read through the artwork.
    target.globalCompositeOperation = 'multiply';
    target.drawImage(face, ART_INSET * w, ART_INSET * h, (1 - 2 * ART_INSET) * w, (1 - 2 * ART_INSET) * h);
    target.restore();
    return true;
  }

  /* A settled tile is composited once - contact shadow included - and then costs
   * a single drawImage per frame. Baking the shadow in matters: canvas shadow
   * blur is expensive enough to blow the frame budget if it runs per tile per
   * frame, and it is the one thing here that does not scale to a full pile. */
  function composite(t, pose, w, makeCanvas) {
    const frame = Math.round((pose.lean - -70) / 5);
    const key = t.type + '|' + frame + '|' + pose.z;
    let hit = cache.get(key);
    if (!hit) {
      const padX = w * SHELL_INSET_X, padY = w * SHELL_INSET_Y;
      const pad = SHADOW_BLUR + contactOffset(pose);
      const canvas = makeCanvas(Math.ceil(w * SHELL_W + pad * 2), Math.ceil(w * SHELL_H + pad * 2));
      const cx = canvas.getContext('2d');
      cx.translate(padX + pad, padY + pad);
      cx.shadowColor = SHADOW_COLOR;
      cx.shadowBlur = SHADOW_BLUR;
      cx.shadowOffsetY = contactOffset(pose);
      const complete = paintTile(cx, t, { ...pose, lean: -70 + frame * 5 }, w);
      hit = { canvas, padX: padX + pad, padY: padY + pad };
      // Face art loads asynchronously. Caching a tile drawn before its artwork
      // arrived would freeze it blank, because later frames reuse the bitmap.
      if (complete) cache.set(key, hit);
    }
    return hit;
  }

  return {
    /* Tiles must arrive already ordered back-to-front; the caller owns depth
     * because it is the same ordering the DOM renderer used for z-index. */
    draw(tiles, m, opts = {}) {
      const { width, height, makeCanvas } = opts;
      if (m.w !== cacheW) { cache.clear(); cacheW = m.w; }
      ctx.clearRect(0, 0, width, height);
      for (const t of tiles) {
        const pose = tilePose(t);
        const box = tileBox(t, pose, m);
        const spin = (t.rot || 0) + (t.rot2 || 0);
        ctx.save();
        ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
        if (spin) ctx.rotate(spin * DEG);
        ctx.translate(-box.w / 2, -box.h / 2);
        if (t.motion || !makeCanvas) {
          // Mid-fall the pose changes every frame, so there is nothing to cache.
          // It also gets no contact shadow, which is right: it is off the table.
          paintTile(ctx, t, pose, m.w);
        } else {
          const hit = composite(t, pose, m.w, makeCanvas);
          ctx.drawImage(hit.canvas, -hit.padX, -hit.padY);
        }
        ctx.restore();
      }
    },

    /* Topmost tile under the point. Tiles arrive back-to-front, so scan back. */
    pick(tiles, m, px, py) {
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i];
        const pose = tilePose(t);
        const box = tileBox(t, pose, m);
        const spin = (t.rot || 0) + (t.rot2 || 0);
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        let dx = px - cx, dy = py - cy;
        if (spin) {
          const c = Math.cos(-spin * DEG), s = Math.sin(-spin * DEG);
          [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
        }
        // A leaning tile covers less ground than its upright box.
        const shrink = Math.cos(pose.lean * DEG);
        if (Math.abs(dx) <= box.w * Math.max(0.35, shrink) / 2 && Math.abs(dy) <= box.h / 2) return t;
      }
      return null;
    },

    /* Drop composited tiles, e.g. once late artwork has loaded. */
    invalidate() { cache.clear(); },

    stats() { return { cached: cache.size }; },
  };
}
