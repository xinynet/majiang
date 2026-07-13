# 趣味麻将碰 · Fun Mahjong Pong

一款移动优先的麻将接龙 PWA，包含无限关卡、欢迎页、个人记录、演示排行榜、新手教学、提示、撤销、洗牌、暂停、结算、本地进度和离线缓存。

## 本地预览

在本目录启动任意静态文件服务器，然后用手机或浏览器访问。不要直接双击 `index.html`，否则离线缓存功能不会启用。

例如：

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`。

## 上架说明

当前交付物是可安装 PWA，也是进入应用商店前的完整交互原型。正式提交 Apple App Store / Google Play 时，建议使用 Capacitor 封装，并补齐：

- iOS 与 Android 多尺寸 PNG 图标和启动图；
- 隐私政策、支持页面、商店截图和应用描述；
- 真机音效、震动、安全区及系统返回键测试；
- Apple 与 Google 开发者签名、包名和版本号。

## 文件

- `index.html`：页面结构与弹层
- `styles.css`：移动端视觉系统和响应式布局
- `app.js`：无限关卡、记录、排行榜与本地进度逻辑
- `manifest.webmanifest`：PWA 安装信息
- `sw.js`：离线缓存
- `assets/icon.svg`：原型图标
