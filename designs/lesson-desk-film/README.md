# 讲题工作台宣传短片工程

150 秒，1920×1080，60fps，无旁白。功能示意使用创作的示例内容，不是实际模型结果或应用录屏。

## 修改与预览

在仓库根目录运行 `node designs/lesson-desk-film/build.mjs`，然后用静态 HTTP 服务打开本目录的 `index.html`。工程使用仓库已有 React、ReactDOM、esbuild，无 CDN 依赖。浏览器保留上次播放位置；空格播放暂停，Home 返回开头。右下角调整面板支持减弱动态。

分镜长度由 `index.html` 的 `OM_SCENES` 管理，画面在 `film.jsx`，视觉样式在 `film.css`。`animations-v3.jsx` 和 `tweaks-panel.jsx` 为 baoyu-design 技能提供的原始时间线组件。

## 素材与发布

应用图标来自本仓库 `assets/app-icon.svg`。中文使用系统微软雅黑；视频导出后无需安装字体。音乐的最终来源与署名见 `music-research.md` 和发布文案。音乐源文件与 MP4 不进入 Git。

片尾项目地址指向 GitHub 项目主页；本片不宣称某个版本已经公开发布，也不包含 Beta 专属错题本。AI 识别与生成需要用户自己的服务账户；教师核对是展示流程的一部分。

## 验证

交付前检查完整视频解码、恒定帧率、音轨、时长、安全区和转场；验证记录见 `verification.json`。浏览器预览不代替成片检查。
