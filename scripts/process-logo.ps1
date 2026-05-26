# 一次性脚本：把 logo 源图处理成 Next.js / UI / 仓库展示需要的各种尺寸。
# 使用：powershell -ExecutionPolicy Bypass -File scripts\process-logo.ps1
# 依赖：System.Drawing（.NET 内置）

param(
    [string]$Source = "C:\Users\simyng\.cursor\projects\r-stack-work-board\assets\c__Users_simyng_AppData_Roaming_Cursor_User_workspaceStorage_dd185324e34ab185a1b104f59627ee94_images_logo-7d7fd5f5-5c88-4cfb-a260-6ad904a27617.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) {
    Write-Error "Logo source not found: $Source"
    exit 1
}

$repoRoot = Split-Path $PSScriptRoot -Parent
Write-Host "Repo root: $repoRoot"
Write-Host "Logo source: $Source"

# 高质量缩放，输出居中 PNG（原图等比缩放后居中放置在 wxh 画布上，可选背景色）
function Save-ResizedPng {
    param(
        [string]$DstPath,
        [int]$Width,
        [int]$Height,
        [System.Drawing.Color]$Background = ([System.Drawing.Color]::Transparent),
        [double]$Padding = 0.0
    )

    $src = [System.Drawing.Image]::FromFile($Source)
    try {
        $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $g.Clear($Background)

            # 等比缩放后居中（考虑 padding）
            $maxW = $Width * (1.0 - $Padding * 2)
            $maxH = $Height * (1.0 - $Padding * 2)
            $ratio = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
            $w = [int]($src.Width * $ratio)
            $h = [int]($src.Height * $ratio)
            $x = [int](($Width - $w) / 2)
            $y = [int](($Height - $h) / 2)
            $g.DrawImage($src, $x, $y, $w, $h)

            # 确保父目录存在
            $dir = Split-Path $DstPath -Parent
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
            $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "  -> $DstPath ($Width x $Height)"
        } finally {
            $g.Dispose()
            $bmp.Dispose()
        }
    } finally {
        $src.Dispose()
    }
}

$white = [System.Drawing.Color]::White
$transparent = [System.Drawing.Color]::Transparent

# 1. Next.js App Router 约定式 metadata
Save-ResizedPng -DstPath (Join-Path $repoRoot "src\app\icon.png") -Width 512 -Height 512 -Background $transparent
Save-ResizedPng -DstPath (Join-Path $repoRoot "src\app\apple-icon.png") -Width 180 -Height 180 -Background $white -Padding 0.08
Save-ResizedPng -DstPath (Join-Path $repoRoot "src\app\opengraph-image.png") -Width 1200 -Height 630 -Background $white -Padding 0.18

# 2. UI 内消费的 brand 资源（透明背景，方便配合主题色）
Save-ResizedPng -DstPath (Join-Path $repoRoot "public\brand\logo-mark.png") -Width 256 -Height 256 -Background $transparent
Save-ResizedPng -DstPath (Join-Path $repoRoot "public\brand\logo-mark@2x.png") -Width 512 -Height 512 -Background $transparent

# 3. README banner（白色背景，logo 居左偏，右侧留空给标题）
Save-ResizedPng -DstPath (Join-Path $repoRoot "docs\brand\banner.png") -Width 1280 -Height 320 -Background $white -Padding 0.10

Write-Host "Done."
