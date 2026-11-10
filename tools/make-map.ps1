Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'public\assets\map-src.png'
$outPath = Join-Path $root 'public\assets\san-andreas-map.jpg'

if (-not (Test-Path $srcPath)) { Write-Error "source map not found: $srcPath"; exit 1 }

$src = [System.Drawing.Image]::FromFile($srcPath)
$size = 1600
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, 0, 0, $size, $size)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 86)
$bmp.Save($outPath, $codec, $params)

$g.Dispose(); $bmp.Dispose(); $src.Dispose()
$sizeOut = (Get-Item $outPath).Length
Write-Output "saved $outPath ($([math]::Round($sizeOut/1KB)) KB)"
