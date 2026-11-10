# 讲题工作台 · Lesson Desk

面向高中英语与语文教师的 Windows 本地备课工具。导入试卷、核对题目与答案，按需生成讲评和教学材料，再放映或导出可编辑的 PPT。

**当前版本：0.15.1** · Electron / React / TypeScript · [定制非商业许可（含教学例外）](LICENSE)

**使用范围：**允许学习研究、教师备课和正常授课，包括收费课程；禁止售卖软件、收费提供软件服务或集成进商业产品。本项目属于源码公开项目，具体边界与历史版本说明见 [许可与商业使用](docs/许可与商业使用.md)。

![PPT 模板与授课编排示例](docs/images/ppt-setup.png)

## 可以做什么

- 导入 PDF、DOCX，或粘贴试卷与参考答案；扫描页通过配置的在线识别服务处理。
- 英语按篇目和题目生成逐题讲评、译文、句法拆解、篇章脉络、词汇手账、考点演练及表达迁移，提供适用题型的专项讲评。
- 语文按材料组组织阅读、文言文、诗歌、默写、语言运用和写作，支持原页图片、多材料关联、教师修订与确认。
- 教师按模块选择生成范围；逐项保存结果，保留版本，支持取消与继续未完成任务。
- 按材料、题目和模块编排授课；放映和 PPT 共用页序，长文分页、短块合页，练习题面与参考答案分开。
- PPT 提供纸面教案、清爽蓝白、墨绿课堂，也可上传 `.pptx` / `.potx` 模板，复用母版、主题及正文区域。
- 课件保存到本机，可导入/导出课件包；API 凭据与课件包分开保存。

## 运行与打包

主要支持 **Windows x64**。请安装 [Node.js 24 LTS](https://nodejs.org/)（包含 npm）和 [Git](https://git-scm.com/)。

```powershell
git clone https://github.com/zazedwhwhy/lesson-desk.git
cd lesson-desk
npm ci
npm run build
npm start
```

生成 Windows 安装包：

```powershell
npm run package
```

构建结果在 `release/`。源码仓库不提交依赖目录、安装包及个人课件。`npm run dev` 只启动浏览器界面预览；文件导入、保存与 AI 等桌面能力请通过 `npm run build` 后的 `npm start` 使用。

## 第一次使用

1. 打开预置示例，或新建课件并选择英语/语文。
2. 在“连接设置”填写服务地址、模型与自己的 API Key；示例浏览和本地测试不需要 API Key。
3. 上传试卷与参考答案，对照原卷核对题目、材料关联和答案，再勾选所需模块开始生成。
4. 核实生成内容，必要时保存教师修订版本。
5. 进入“输出课件”或“编排授课 / PPT”，勾选内容、选择模板，再放映或导出。

AI 请求会把本次任务所需的材料发送给你配置的服务商，可能产生费用；联网生成前请确认材料的使用权限和服务商设置。应用没有内置可供公众使用的 API Key。

## 数据与边界

课件、设置和模板保存在 Electron 的当前用户数据目录。API Key 通过 Electron `safeStorage` 加密，仍应保护好当前 Windows 账户和应用数据目录。课件包不包含 API 凭据。

PDF 阅读顺序由版面估算，扫描识别、材料整理和 AI 讲义均需教师对照原件核实。缺失、冲突或过期内容不会自动视为已确认。旧版 `.doc`、音频转写暂不支持。

自定义 PPT 读取母版/版式中的背景、装饰、主题与正文空间；模板示例文字不会进入课件。复杂效果、字体缺失和 PowerPoint 渲染差异请以实际打开结果为准。详见 [PPT 模板与紧凑分页](docs/PPT模板与紧凑分页-0.15.0.md) 和 [语文功能说明](docs/语文整卷功能-0.14.0.md)。

## 开发与验证

```powershell
npm test
npm run build
npm run check:public
```

测试使用本地合成材料和模拟请求，不要求真实 API 凭据。既有本地测试与打包程序验证通过，不代表任意服务商、整卷识别或任意 PPT 模板都已完成端到端验收。

GitHub Actions 在 `main` 推送和 Pull Request 时运行公开内容检查、测试及构建。具体协作方式见 [开发与 Git 工作流](docs/开发与Git工作流.md)；贡献要求见 [CONTRIBUTING](CONTRIBUTING.md)。

```text
src/core/       学科模型、校验、教学内容和共享分页
src/desktop/    Electron、材料导入、AI 调用、存储和 PPT 导出
src/ui/         React 界面
scripts/        构建及本地验证脚本
tests/          自动化测试
assets/fonts/   字体及其许可证
docs/           公开使用文档与开发指南
```

## 许可证与致谢

自 `0.15.1` 起，本项目按 [Lesson Desk Noncommercial License 1.0](LICENSE) 提供，保留普通教学使用的明确例外。这是项目定制许可，不是标准的开源许可证。

历史版本 `v0.15.0` 及初始提交仍按 MIT 授权，可以继续按原许可使用、分发及商用；本次修改不追溯限制这些权利。该历史范围的声明保存在 [LICENSES/MIT-v0.15.0.txt](LICENSES/MIT-v0.15.0.txt)，不表示后续新增内容可任选 MIT。此次 `0.15.1` 主要调整许可和说明，不声称已把原 MIT 代码的既有商用权全部收回。

Literata 与霞鹜文楷保留 SIL Open Font License 1.1；第三方组件和用户上传材料保留各自权利。来源及声明见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
