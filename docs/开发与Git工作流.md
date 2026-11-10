# 开发与 Git 工作流

远程仓库：<https://github.com/zazedwhwhy/lesson-desk>。`main` 保存可构建的版本，新增功能或修复在分支上进行。

当前版本使用定制非商业许可并保留正常教学例外；提交新贡献前请阅读 [许可与商业使用](许可与商业使用.md)。历史 `v0.15.0` 的原 MIT 权利不受此次调整影响。

## 第一次在另一台电脑使用

安装 Git、Node.js 24 LTS（包含 npm），然后运行：

```powershell
git clone https://github.com/zazedwhwhy/lesson-desk.git
cd lesson-desk
npm ci
npm run build
npm start
```

API Key 在桌面程序的“连接设置”中填写，仓库不提供公共密钥。只查看示例、运行测试和构建不需要付费 API。

## 开始修改

先确认工作区，再拉取更新和建立分支：

```powershell
git status
git switch main
git pull --ff-only
git switch -c feat/your-feature
```

有尚未提交的修改时，先提交到自己的分支再切换；不要为了切换而使用强制丢弃修改的命令。

## 检查并提交

```powershell
npm test
npm run build
git status
git diff
git add src tests
git diff --cached
npm run check:public
git commit -m "feat: describe the change"
git push -u origin feat/your-feature
```

修改文档、配置或资源时，把对应路径也加入 `git add`，检查暂存区后再提交。在 GitHub 发起 Pull Request，检查 CI 结果并合并。

个人维护时也可在 `main` 直接完成上述提交步骤；多人协作优先用分支和 Pull Request。

## 查看与恢复

```powershell
git log --oneline --decorate -10
git show HEAD
git diff HEAD
```

撤销一个已经提交的修改，优先使用 `git revert <提交号>` 创建反向提交，保留历史。恢复未提交的单个文件会丢失该文件的修改，执行前应先看 `git diff`，有需要时另存备份。

## 什么会被上传

源码、测试、构建配置、公开文档、示例界面图和带许可证的字体会进入 Git。依赖、构建输出、安装包、个人课件、API 配置和历史本机验证记录由 `.gitignore` 排除，仍保存在本机。

Git 管理源码版本；应用里的课件仍使用原有本地保存和导入/导出功能。提交源码不等于备份个人课件。

若首次推送提示 GitHub 登录，请通过 Git Credential Manager 的浏览器登录完成认证，不把密码或 Token 写进远程地址、脚本或仓库文件。当前仓库使用 GitHub 的匿名提交邮箱，不公开账户的私人邮箱。
