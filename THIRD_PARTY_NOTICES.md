# 第三方组件与字体

本项目自行编写的源码按根目录 [MIT License](LICENSE) 授权。第三方组件及字体保留各自的许可证，不因本项目的 MIT 许可而改换授权。

## 随项目分发的字体

| 字体 | 来源 | 许可证 |
| --- | --- | --- |
| Literata，可变字体，未修改 | [Google Fonts / Literata](https://github.com/google/fonts/tree/main/ofl/literata) | [SIL OFL 1.1](assets/fonts/Literata-OFL.txt) |
| 霞鹜文楷 Regular v1.530，未修改 | [LXGW WenKai](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530) | [SIL OFL 1.1](assets/fonts/WenKai-OFL.txt) |

分发字体时应保留对应的版权及许可证文本，字体不单独按 MIT 许可重新授权。

## 软件依赖

依赖及锁定版本记录在 `package.json` 与 `package-lock.json` 中。Electron、React、PptxGenJS、Mammoth、fflate、Zod、Lucide、PDF.js、sanitize-html、xmldom、Canvas 等组件的许可文本随安装后的依赖提供；再分发时须保留相应声明。

示例课件用于演示软件流程，不是实际 API 生成结果。用户自行导入的试卷、文章、图片、字体和 PPT 模板不包含在源码许可范围内，其使用与分享须遵循各自的授权。

## 离线公式渲染

MathJax 3.2.2（含 TeX 字体路径数据）使用 Apache-2.0，mhchemparser 使用 Apache-2.0。两者随应用打包，许可证位于 assets/licenses；不需要外部 CDN。
