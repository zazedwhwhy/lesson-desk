$ErrorActionPreference='Stop'
$work=Join-Path $PSScriptRoot 'work'
$nodeDir=Join-Path $env:LOCALAPPDATA 'Programs/openmotion-deps/node-v26.11.1-win-x64'
$env:Path="$nodeDir;$env:Path"
$helper=Join-Path $env:USERPROFILE '.codex/plugins/cache/openai-curated-remote/open-design/0.1.0/skills/openmotion-production/scripts/local-mcp.mjs'
function Read-Result($name) {
    $envelope=Get-Content (Join-Path $work "$name.result.json") -Raw|ConvertFrom-Json
    if($envelope.isError){throw $envelope.content[0].text}
    return $envelope.content[0].text|ConvertFrom-Json
}
function Invoke-Motion($operation,$name,$payload) {
    $payload|ConvertTo-Json -Depth 8|Set-Content (Join-Path $work "$name.json") -Encoding utf8
    $result=& "$nodeDir/node.exe" $helper call $operation --input (Join-Path $work "$name.json") --home "$env:LOCALAPPDATA/openmotion/runtime" --codex (Get-Command codex.exe).Source
    if($LASTEXITCODE){throw "OpenMotion $operation exited $LASTEXITCODE"}
    $result|Set-Content (Join-Path $work "$name.result.json") -Encoding utf8
    Read-Result $name
}
if(!(Test-Path (Join-Path $work 'create.result.json'))){
    $null=Invoke-Motion openmotion_create_project create @{requestId='focus-film-20261121-01';projectType='natural_language';title='对焦 · 讲题工作台';namingLanguage='zh-CN';requirements='96 秒实拍与三维宣传片，1920×1080，60fps。'}
}
$id=(Read-Result create).projectId
if(!(Test-Path (Join-Path $work 'begin.result.json'))){
    $null=Invoke-Motion openmotion_open_preview begin @{projectId=$id;requestId='focus-begin-01';action='begin';mode='create'}
}
$round=(Read-Result begin).inlineWork.id
$names=@('教室与镜片','镜筒解锁与标片对位','原图核对与教师修订','光闸与课堂放映','PowerPoint 修改','课堂回声')
$cuts=@(0,12,41,57,81,87,96)
$items=@(for($i=0;$i -lt $names.Length;$i++){@{name=$names[$i];sourcePath=(Join-Path $work "seq-$i.mp4");itemId="s$i"}})
$items+=@{name='Tobu · Hope 与环境拟音';sourcePath=(Join-Path $work 'score.wav');itemId='audio'}
$import=Invoke-Motion openmotion_import_assets import @{projectId=$id;requestId='focus-import-01';items=$items}
$state=Invoke-Motion openmotion_get_project detail @{projectId=$id}
$tags=@(for($i=0;$i -lt 6;$i++){
    $asset=$import.items|Where-Object itemId -eq "s$i"
    $len=$cuts[$i+1]-$cuts[$i]
    if($asset.status -ne 'completed' -or $asset.duration -ne $len){throw "素材时长不符 $i"}
    '<video class="clip" id="s{0}" data-hf-id="s{0}" data-name="{1}" data-track-index="0" data-start="{2}" data-duration="{3}" src="{4}" muted playsinline></video>' -f $i,$names[$i],$cuts[$i],$len,$asset.path
})
$audio=$import.items|Where-Object itemId -eq 'audio'
if($audio.status -ne 'completed' -or $audio.duration -ne 96){throw '音轨长度或状态异常'}
$tags+='<audio class="clip" id="music" data-hf-id="music" data-name="Hope 与环境拟音" data-track-index="1" data-start="0" data-duration="96" data-volume="1" src="'+$audio.path+'"></audio>'
$html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>对焦 · 讲题工作台</title><script src="assets/gsap.min.js"></script><style>*{margin:0}#main{position:relative;width:1920px;height:1080px;overflow:hidden;background:white}video{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="main" data-hf-id="main" data-composition-id="main" data-start="0" data-duration="96" data-width="1920" data-height="1080" data-fps="60">'+($tags -join "`n")+'</div><script>window.__timelines={main:gsap.timeline({paused:true})};</script></body></html>'
$edit=Invoke-Motion openmotion_edit_project edit @{projectId=$id;workId=$round;requestId='focus-cut-01';expectedRevision=$state.revision;expectedVersionId=$state.currentVersionId;files=@(@{path='index.html';content=$html});summary='96 秒实拍与三维成片，六段可调整镜头，独立立体声音轨。'}
$guard=@{projectId=$id;workId=$round;expectedRevision=$edit.revision;expectedVersionId=$edit.version.versionId}
$null=Invoke-Motion openmotion_open_preview complete ($guard+@{requestId='focus-complete-01';action='complete_generation'})
$null=Invoke-Motion openmotion_open_preview preview ($guard+@{requestId='focus-preview-01';action='open'})
$job=(Invoke-Motion openmotion_export_request export @{projectId=$id;workId=$round;requestId='focus-export-01';expectedRevision=$edit.revision;versionId=$edit.version.versionId;audio='required'}).job
Write-Output "OpenMotion export $($job.id)"
do {
    Start-Sleep -Seconds 12
    $status=(Invoke-Motion openmotion_get_project query @{projectId=$id;exportJobId=$job.id}).exportJob
    Write-Output "$($status.state) $($status.stage)"
    if($status.state -in @('failed','cancelled','expired')){throw ($status|ConvertTo-Json -Depth 6)}
} while(!$status.verification.file -and $status.state -notin @('succeeded','completed'))
$file=$status.verification.file
if(!$file -or !(Test-Path -LiteralPath $file)){throw 'OpenMotion 未返回已核验的文件'}
$out=Join-Path $PSScriptRoot 'out'
$null=New-Item -ItemType Directory -Force -Path $out
$dest=Join-Path $out '对焦-OpenMotion-1080p60.mp4'
Copy-Item -LiteralPath $file -Destination $dest
if((Get-FileHash $file).Hash -ne (Get-FileHash $dest).Hash){throw '交付副本哈希不符'}
Write-Output $dest
