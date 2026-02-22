# Icon 处理与替换手册（临时，2026-02-23）

> 目的：在不改业务代码的前提下，支持后续频繁替换品牌图标；当前是短期临时文档，品牌方案稳定后可删除。

## 1. 规范与实现口径

- 源图使用你提供的原图文件，不重绘、不二次设计。
- macOS 图标容器不再用经验参数拟合，改为系统官方资源组合：
  - 容器尺寸/留白：来自系统 `Assets.car` 中 `AppIcon`
  - 圆角轮廓：来自系统 `AppIcon.icns` 的最终 alpha
- 最终生成用于 Electron 的静态资源（`png/icns/ico`），保证 Dock、窗口、安装包统一。

核心脚本：
- `scripts/branding/build-icons.py`

## 2. 文件约定

输入（只改这一个）：
- `branding/source/app-icon.png`

输出（自动生成，不手改）：
- `src/renderer/public/branding/app-icon.png`
- `public/branding/app-icon.png`
- `public/branding/app-icon-desktop.png`
- `public/branding/icon.icns`
- `public/branding/icon.ico`

## 3. 日常替换流程

1. 用新图覆盖 `branding/source/app-icon.png`
2. 运行 `npm run branding:build`
3. 重启应用验证界面与 Dock 图标
4. 如果要发布安装包，再执行 `npm run dist:mac` 或对应平台打包命令

## 4. 生效校验清单

基础检查：
- `branding/source/app-icon.png` 存在且为期望版本
- `npm run branding:build` 无报错

输出检查：
- 渲染层 logo/favicon：`src/renderer/public/branding/app-icon.png`
- 桌面图标：`public/branding/app-icon-desktop.png`
- 打包图标：`public/branding/icon.icns` 与 `public/branding/icon.ico`

推荐快速核验命令：

```bash
python3 - <<'PY'
from PIL import Image
for p in ['public/branding/app-icon-desktop.png', 'public/branding/icon.icns', 'public/branding/icon.ico']:
    im = Image.open(p).convert('RGBA')
    print(p, im.size, im.getchannel('A').getbbox())
PY
```

## 5. 常见问题

### 5.1 看起来还是旧图标

- 完全退出应用后再启动一次
- 如 Dock 缓存未刷新，可执行：`killall Dock`

### 5.2 圆角异常或看起来像方角

- 先确认 `npm run branding:build` 输出中是否打印了两条系统来源：
  - `macOS container bbox source: ...Assets.car`
  - `macOS rounded-shape source: ...AppIcon.icns`
- 若来源丢失，脚本会失败并报错，不会 silently 回退到经验参数

### 5.3 新图替换后尺寸看起来不一致

- 当前尺寸由系统官方容器 bbox 控制，不通过手工比例参数调节
- 若视觉仍异常，优先检查源图本身边缘是否有额外留白

## 6. 代码接入点

渲染层 logo / favicon：
- `src/shared/branding.ts`
- `src/renderer/components/ChatArea.tsx`
- `src/renderer/components/Sidebar.tsx`
- `src/renderer/main.tsx`
- `src/renderer/index.html`

桌面窗口 / Dock / 打包：
- `src/main-process/branding-assets.ts`
- `src/main-process/window-factory.ts`
- `src/main.ts`
- `package.json`
- `electron-builder.yml`
