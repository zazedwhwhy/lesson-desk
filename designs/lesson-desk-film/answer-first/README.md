# 答案先别放

《讲题工作台》0.18.0 的 150 秒宣传片。成片位于 `out/答案先别放-1080p60.mp4`，配有同名 SRT 和独立海报。导演稿在上一级目录。

## 素材

Mia 和 Sam 的阅读题为自编材料。卷面与选题使用动画表现；原材料、授课编排、课件列表及三种课堂页由本仓库的 React 界面组件渲染。英语演示使用同一份输入经过独立 Skill 构建得到课件包，再调用产品分页与 PPT 导出模块。本机 PowerPoint 在第 2 页将“哪几个词告诉你”改成“哪些词能说明”，另存副本。片中展示这两张实际导出图。化学题图来自本项目自有测试试卷的排水集气示意。片头与片尾的铅笔画及海报使用图像生成。

音乐为 Tobu《Hope》。本片剪辑原曲、调整音量、叠加纸声并淡出。作者音源及此前保存的许可记录见 [音乐资料](../music-research.md)。发布简介请保留以下署名。

> Music by Tobu — Hope. Source: https://soundcloud.com/7obu/tobu-hope-original-mix
>
> Creative Commons Attribution 3.0: https://creativecommons.org/licenses/by/3.0/
>
> Excerpted, mixed with paper sounds, volume adjusted and faded for this film.

## 在 Windows 上重新制作

在仓库根目录运行。需要项目依赖、Chrome、PowerPoint、FFmpeg，以及含 NumPy 的 Python。音源放在上一级 `assets/tobu-hope-full.mp3`。中间素材保存在本片 `work/`，导出件在 `out/`。

~~~powershell
$film = 'designs/lesson-desk-film/answer-first'
.\node_modules\@esbuild\win32-x64\esbuild.exe "$film/materials.tsx" --platform=node --format=cjs --bundle --packages=external --loader:.css=empty "--outfile=$film/work/make.cjs"
node "$film/work/make.cjs"
node "$film/plates.mjs"
& "$film/powerpoint.ps1"
node "$film/render.mjs" proof
node "$film/render-scenes.mjs"
python "$film/sound.py"
0..8 | ForEach-Object {"file 'scene-$_.mp4'"} | Set-Content "$film/work/concat.txt" -Encoding ascii
ffmpeg -v error -y -f concat -safe 1 -i "$film/work/concat.txt" -i "$film/work/score.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart "$film/out/答案先别放-1080p60.mp4"
node "$film/check-playback.mjs"
~~~

修改文字、动作及章节时码用 `timeline.mjs`。OpenMotion 工程把九段画面和配乐独立放在时间线上；若要重新装配，先用运行时的导入工具取得本次素材路径，再用 `openmotion-entry.mjs` 生成对应的版本化保存请求。
