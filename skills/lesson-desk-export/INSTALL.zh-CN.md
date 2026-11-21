# 在其他 AI 客户端使用讲题工作台 Skill

本 Skill 使用 Agent Skills 的 `SKILL.md` 格式。不同客户端共用讲题规范与生成脚本，输出的 `.lesson.zip` 都在讲题工作台首页通过「导入课件包」打开。

## 两种生成方式

- **工作台内生成**。在「连接设置」配置模型 API，上传材料，在应用内生成所需模块。
- **通过 Skill 生成**。由 AI 客户端使用它已经连接的模型读取材料并写讲义，随包脚本在该客户端的终端打包。把生成的 `.lesson.zip` 导入工作台，即可在篇目里打开「词汇手账」等模块，继续修订或放映。导入与查看无需工作台的 API Key。导入会创建一份独立课件。在应用内点击「重新生成」时使用工作台自己的连接。

## OpenCode、Pi、Hermes Agent、WorkBuddy

| 客户端 | 安装与调用 |
| --- | --- |
| OpenCode | 解压后把整个 `lesson-desk-export` 放进项目内 `.opencode/skills/` 或共用的 `~/.agents/skills/`。开启新会话并指定加载 `lesson-desk-export`。 [OpenCode Skills](https://opencode.ai/docs/skills/) |
| Pi | 解压后运行 `pi install "<lesson-desk-export 目录的完整路径>"`，保留该目录。也可放进 `~/.agents/skills/`，这两种方式选一种即可。在会话中用 `/skill:lesson-desk-export`。 [Pi Packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) · [Pi Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md) |
| Hermes Agent | 将解压出的整个 `lesson-desk-export` 目录放进当前 Hermes 配置的 `skills/`，默认是 `~/.hermes/skills/`。用 `/reload-skills` 刷新后调用 `/lesson-desk-export`。让 Hermes 的终端执行环境能访问 Skill 目录和材料文件，并在该环境执行 `node --version`。 [Hermes Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) · [命令参考](https://hermes-agent.nousresearch.com/docs/reference/slash-commands) |
| 腾讯 WorkBuddy | 在「技能」中选择「上传技能」或「导入技能」，选择完整 Skill ZIP。将试卷和答案放在 WorkBuddy 可访问的工作区，使用本地任务模式执行生成。 [腾讯云 WorkBuddy 官方说明](https://indonesia.tencentcloud.com/document/product/1316/84504) |

**在 OpenCode 中使用 DeepSeek。** 先让 OpenCode 加载 Skill，再按 DeepSeek 官方接入文档连接并选择模型。OpenCode 提供本地文件与终端工具，DeepSeek 负责解读试卷与生成内容。该接入方法适用于 DeepSeek 作为模型服务的用法。DeepSeek 官方聊天页面的自定义 Skill 安装和成品直出暂无已核实入口。 [DeepSeek 接入 OpenCode](https://api-docs.deepseek.com/quick_start/agent_integrations/opencode/)

## 其他 Agent Skills 客户端

| 客户端 | 安装与调用 |
| --- | --- |
| Claude Code | 解压后把整个 `lesson-desk-export` 放进 `~/.claude/skills/`，或项目内的 `.claude/skills/`。在会话中用 `/lesson-desk-export`。 [Claude Code 文档](https://code.claude.com/docs/en/skills) |
| Cursor | 把整个目录放进 `~/.agents/skills/`，或项目内的 `.cursor/skills/`。在 Agent 对话里输入 `/` 查找。 [Cursor 文档](https://cursor.com/docs/skills) |
| Gemini CLI | 把整个目录放进 `~/.gemini/skills/`，或项目内的 `.gemini/skills/`。用 `/skills list` 检查，再在会话中指定 `lesson-desk-export`。 [Gemini CLI 文档](https://geminicli.com/docs/cli/skills/) |
| Claude 网页版 | 在 `Customize → Skills → Create skill → Upload a skill` 上传 Skill ZIP。启用代码执行与文件创建。 [Claude 官方说明](https://support.claude.com/en/articles/12512180-use-skills-in-claude) |
| ChatGPT 自定义技能 | 有上传入口的账户可从 `插件 → 技能 → 创建 → 从电脑上传` 试用 Skill ZIP。 [ChatGPT 官方说明](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) |
| Codex | 把整个目录放进 `~/.agents/skills/` 或项目内 `.agents/skills/`，用 `$lesson-desk-export`。 [Codex 文档](https://learn.chatgpt.com/docs/build-skills) |

客户端执行环境需要 Node.js 22 或更高，并允许访问教学文件和执行脚本。化学公式的 PNG 预览还需要在脚本执行目录安装 `@napi-rs/canvas@1.1.0`。若没有文件或终端权限，只能准备结构化讲评数据，生成 PPT 和课件包需要可执行的客户端环境。

在 Hermes 中可以把英文原文附在这条请求后面。

> /lesson-desk-export 给这篇英语阅读做词汇手账，选 6 个值得学的词或短语。交付可编辑 PPT 和讲题工作台课件包。

如果同时提供试卷和参考答案，可以继续指定「加上第 21–24 题的讲评、篇章脉络和两句句法拆解」。

生成完成后，从客户端打开输出目录，下载或复制 `.pptx`、`.lesson.zip` 和待核对清单。如果 Hermes 在容器或远程机器运行，文件先保存在那个执行环境中，把课件包传回运行讲题工作台的电脑即可导入。
