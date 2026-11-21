$ErrorActionPreference='Stop'
$work = Join-Path $PSScriptRoot 'work'
$app = New-Object -ComObject PowerPoint.Application
try {
    $deck = $app.Presentations.Open((Join-Path $work 'focus.pptx'), -1, 0, 0)
    try {
        if ($deck.Slides.Count -ne 3) { throw '课堂输出应含三页' }
        $page = $deck.Slides.Item(3)
        $page.Export((Join-Path $work 'ppt-before.png'),'PNG',1920,1080)
        $needle='比较同一温度下的两个点'
        $changed=0
        foreach ($shape in $page.Shapes) {
            if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                $range=$shape.TextFrame.TextRange
                if ($range.Text.Contains($needle)) {
                    $range.Text=$range.Text.Replace($needle,('先'+$needle))
                    $changed++
                }
            }
        }
        if ($changed -ne 1) {throw '预期只有一个可编辑文本框包含指定原句'}
        $page.Export((Join-Path $work 'ppt-after.png'),'PNG',1920,1080)
        $deck.SaveCopyAs((Join-Path $work 'focus-edited.pptx'))
        $deck.Saved=-1
    } finally { $deck.Close() }
} finally { if ($app.Presentations.Count -eq 0) { $app.Quit() } }
