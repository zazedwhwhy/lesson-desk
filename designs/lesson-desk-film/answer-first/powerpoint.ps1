$ErrorActionPreference='Stop'
$work = Join-Path $PSScriptRoot 'work'
$powerpoint = New-Object -ComObject PowerPoint.Application
try {
    $deck = $powerpoint.Presentations.Open((Join-Path $work 'forest.pptx'), -1, 0, 0)
    try {
        if ($deck.Slides.Count -ne 5) {throw 'Unexpected page count'}
        $page = $deck.Slides.Item(2)
        $page.Export((Join-Path $work 'powerpoint-before.png'),'PNG',1920,1080)
        $changed = $false
        foreach ($shape in $page.Shapes) {
            if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                $range = $shape.TextFrame.TextRange
                if ($range.Text.Contains('哪几个词告诉你')) {
                    $range.Text = $range.Text.Replace('哪几个词告诉你','哪些词能说明')
                    $changed = $true
                }
            }
        }
        if (!$changed) {throw 'Prompt not found in editable text'}
        $page.Export((Join-Path $work 'powerpoint-after.png'),'PNG',1920,1080)
        $deck.SaveCopyAs((Join-Path $work 'forest-edited.pptx'))
        $deck.Saved = -1
    } finally { $deck.Close() }
} finally { if ($powerpoint.Presentations.Count -eq 0) { $powerpoint.Quit() } }
