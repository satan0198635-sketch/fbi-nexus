# Minimal static file server used only for local preview (Node.js is not installed on this machine).
param([int]$Port = 5173)

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\public")).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Serving $root on http://localhost:$Port/"

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".ico"  = "image/x-icon"
  ".pdf"  = "application/pdf"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $rel = $path.TrimStart("/") -replace "/", "\"
    $file = Join-Path $root $rel
    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.Close()
  } catch {
    if ($listener.IsListening) { Write-Output "ERR $($_.Exception.Message)" }
  }
}
