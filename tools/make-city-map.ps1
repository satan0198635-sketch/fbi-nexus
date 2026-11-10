Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'public\assets\map-src.png'
$outPath = Join-Path $root 'public\assets\los-santos-map.jpg'

if (-not (Test-Path $srcPath)) { Write-Error "source map not found: $srcPath"; exit 1 }

$src = [System.Drawing.Image]::FromFile($srcPath)

# Los Santos urban area inside the 8192px atlas (corresponds to state-space x 321.9 y 618.8 w/h 300)
$cropX = 2637
$cropY = 5069
$cropSize = 2458
$out = 1800

$dst = New-Object System.Drawing.Bitmap($out, $out)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
$dstRect = New-Object System.Drawing.Rectangle(0, 0, $out, $out)
$g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 88)
$dst.Save($outPath, $codec, $params)

$g.Dispose(); $dst.Dispose(); $src.Dispose()
Write-Output "saved $outPath ($([math]::Round((Get-Item $outPath).Length/1KB)) KB)"
