/* 启动页。对应小程序的 pages/splash/splash.vue。
 *
 * 两条法定文案（健康游戏忠告、音数协 12+ 适龄提示）必须留着，而且必须是**真实文字渲染**
 * 而不是烤进底图——备案曾因「无法辨识图内文本内容」被退回一次，见 HANDOFF_FIX_RECORD。
 * canvas 上画文字天然就是矢量绘制，这一点比小程序侧还稳。
 *
 * 进度条不是装饰：它遮的是首页 15 张精灵的预加载。加载完之前就跳首页，
 * 玩家会看着按钮一个个蹦出来。
 */
const { viewport } = require('../screen.js');
const { replaceScene } = require('../app.js');
const { img, loadImages, vw, vh, rem, text, roundRect, drawCover, drawContain } = require('../ui.js');
const { buildLayout } = require('../home-layout.js');

const LEGAL_BODY = '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。'
  + '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。';

// 够久才读得出是在加载，而不是闪了一下
const MIN_SHOW_MS = 1800;

/** 把长文按可用宽度折行。canvas 没有自动换行，只能自己算。 */
function wrap(ctx, str, maxWidth, font) {
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const ch of str) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createSplashScene(makeHomeScene) {
  let progress = 6;
  let startedAt = 0;
  let loaded = false;

  return {
    enter() {
      startedAt = Date.now();

      /* 首屏自己的两张图先来，首页那 15 张跟在后面。
       * 清单由 home-layout.js 的产物生成，换素材不用两头改。 */
      loadImages({
        splash_bg: 'static/ui/splash_bg.jpg',
        age_badge: 'static/ui/age_rating_12plus.png',
      }).then(() => {
        const table = { bg_home: 'static/ui/home/bg_home.webp' };
        buildLayout().forEach((s) => { table[s.key] = 'static/ui/home/' + s.file; });
        return loadImages(table);
      }).then(({ failed }) => {
        if (failed.length) console.warn('[splash] 预加载有缺图', failed);
        loaded = true;
      }).catch((e) => {
        console.error('[splash] 预加载失败', e);
        loaded = true;   // 缺图也要放人进去，首页自己还会再试一次
      });
    },

    update(dt) {
      // 进度条先匀速爬到 90%，剩下 10% 等真正加载完，避免「读到 100% 还卡着」
      const target = loaded ? 100 : 90;
      progress = Math.min(target, progress + dt * 55);
      if (loaded && progress >= 100 && Date.now() - startedAt >= MIN_SHOW_MS) {
        replaceScene(makeHomeScene());
      }
    },

    draw(ctx) {
      ctx.fillStyle = '#2f5d4f';
      ctx.fillRect(0, 0, viewport.W, viewport.H);
      const bg = img('splash_bg');
      if (bg) drawCover(ctx, bg, { x: 0, y: 0, w: viewport.W, h: viewport.H });

      const footerY = viewport.H - viewport.safeBottom - vh(20);
      const badge = { x: vw(6), y: footerY, w: vw(15), h: vw(15) };
      drawContain(ctx, img('age_badge'), badge);

      const textX = badge.x + badge.w + vw(3);
      const textW = viewport.W - textX - vw(6);
      text(ctx, '健康游戏忠告', textX, footerY + vh(1.2),
        { align: 'left', baseline: 'top', size: rem(0.82), weight: 'bold', color: '#fff', stroke: 'rgba(0,0,0,.45)' });

      const font = `${rem(0.62)}px sans-serif`;
      const lines = wrap(ctx, LEGAL_BODY, textW, font);
      lines.forEach((line, i) => {
        text(ctx, line, textX, footerY + vh(4) + i * rem(0.86),
          { align: 'left', baseline: 'top', size: rem(0.62), color: 'rgba(255,255,255,.92)', stroke: 'rgba(0,0,0,.4)' });
      });

      const track = { x: vw(12), y: viewport.H - viewport.safeBottom - vh(6), w: vw(76), h: vh(1.1) };
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      roundRect(ctx, track, track.h / 2);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      roundRect(ctx, { ...track, w: Math.max(track.h, track.w * progress / 100) }, track.h / 2);
      ctx.fill();
    },
  };
}

module.exports = { createSplashScene };
