# 讲题工作台宣传片音乐核查

核查日期：2026-11-16。仅通过公开网页、公开元数据与普通 HTTP 访问核查；未注册账号、未付费、未绕过 DRM。

## 可用音源：Tobu — Hope

- 成片可用本地文件：`assets/tobu-hope-full.mp3`。
- 作者官方音源入口：[Tobu Bandcamp / Hope](https://7obu.bandcamp.com/track/hope)。取用该页公开提供的完整 MP3-128 播放音流，未取得收费无损下载。
- 同一作者认证账号的许可依据：[Tobu SoundCloud / Tobu - Hope](https://soundcloud.com/7obu/tobu-hope-original-mix)。当前页面与 hydration 元数据明确标记 `license: cc-by`，作者 `Tobu`、账号 `7obu`、`verified: true`。
- 版本核对：Bandcamp 曲名 `Tobu - Hope`、作者 Tobu、原发行日期 2014-03-30、曲长 288.34 秒；SoundCloud 原混音页面同名、同发行日、完整曲长 288.391 秒。二者是同曲原版完整录音的发布入口；未做声学指纹逐采样对比。
- SoundCloud 当前官方脚本将 `cc-by` 映射为 `http://creativecommons.org/licenses/by/3.0/`：[映射代码来源](https://a-v2.sndcdn.com/assets/56-218fab0e.js)。该脚本 URL 会随网站发布变化。
- [CC BY 3.0 官方条款](https://creativecommons.org/licenses/by/3.0/)允许复制、分享和改编，也允许商业用途；需注明作者、作品、来源、许可，并说明修改。没有 YouTube 独占或地域限制。因此按该作者声明，可用于署名后的宣传片和 YouTube / B站发布。
- Bandcamp 页面单独标记保留版权，不能把购买音源或公开播放本身当作同步使用许可；本方案使用依据是作者当前 SoundCloud 的 CC BY 声明。保留了该声明的精选元数据，见 `assets/hope-source-evidence.json`。

建议复制到视频简介和片尾的署名（最后一行应与成片实际编辑一致）：

```text
音乐：Tobu - Hope
作者：Tobu（Toms Burkovskis）
来源：https://soundcloud.com/7obu/tobu-hope-original-mix
许可：Creative Commons Attribution 3.0（CC BY 3.0）
https://creativecommons.org/licenses/by/3.0/
本视频对音乐作了截取、音量调整和淡出处理。
```

平台自动版权识别是否提出申诉未实测；公开许可不等同于平台预先白名单。

## 文件验证

| 检查 | 结果 |
| --- | --- |
| 编码 | MP3，44,100 Hz，双声道 |
| 完整时长 | 288.365714 秒（4分48秒） |
| 文件大小 | 4,614,268 字节 |
| SHA-256 | `939a25142963f06749a610f9634d11305579c89e26666b43a019b8e8a7e991c5` |
| FFmpeg 全文件解码 | 退出码 0，错误输出为空 |

`hope-source-evidence.json` 保留官方入口、许可元数据及音源校验值；临时音流地址不作为永久下载链接保存。

## Sunburst / Cloud 9 / Candyland 的当前状态

优先核查了 Sunburst，其它两首用于交叉核对。

| 曲目 | 作者官方来源 | 当前核查结果 |
| --- | --- | --- |
| Tobu & Itro — Sunburst | [SoundCloud](https://soundcloud.com/7obu/sunburst) / [Bandcamp](https://7obu.bandcamp.com/track/sunburst) | SoundCloud `all-rights-reserved`；旧 `tobu.io/Sunburst` 和 `/download` 均返回 404；Bandcamp 下载收费。未取得免费商用同步许可。 |
| Itro & Tobu — Cloud 9 | [SoundCloud](https://soundcloud.com/7obu/cloud-9) | `all-rights-reserved`，旧官方许可入口返回 404。 |
| Tobu — Candyland | [SoundCloud](https://soundcloud.com/7obu/candyland) | `all-rights-reserved`，旧官方许可入口返回 404。 |

[RouteNote 的 Sunburst 曲目页](https://licensing.routenote.com/track/sunburst)公开元数据给出完整音流 `https://storage.googleapis.com/routenote-licensing-storage/public/tracks/Sunburst.mp3`，但 `is_free: 0`、`is_hidden: 1`。[RouteNote FAQ](https://licensing.routenote.com/about-us/faq)明确说明音乐下载需付费订阅。其自动署名片段包含“Licensed free”字样，与付费状态不能混为一谈；本次未把该音流下载或用于成片，也未把旧 NCS 标签、第三方转载描述当作当前许可。

作者官网 [tobu.io](https://tobu.io/)目前转向 [tobumusic.com](https://tobumusic.com/)，首页仅显示新版本预告，没有当前公开授权细则。
