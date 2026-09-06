# Rota er mappa dette skriptet ligg i, slik at repoet kan liggje kvar som helst
# — og slik at eit skript inne i ein worktree serverer den worktreen.
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8083/')
$listener.Start()
Write-Host 'Server running on http://localhost:8083'
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript'
  '.css'  = 'text/css'
  '.json' = 'application/json; charset=utf-8'
  '.csv'  = 'text/csv; charset=utf-8'
  '.png'  = 'image/png'
  '.woff2' = 'font/woff2'
  '.woff'  = 'font/woff'
  '.xml'  = 'application/xml'
  '.ico'  = 'image/x-icon'
  '.mp3'  = 'audio/mpeg'
  '.svg'  = 'image/svg+xml'
  '.wav'  = 'audio/wav'
  '.ogg'  = 'audio/ogg'
  '.m4a'  = 'audio/mp4'
  '.flac' = 'audio/flac'
  '.opus' = 'audio/ogg'
  '.webm' = 'audio/webm'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $local = $req.Url.LocalPath.TrimStart('/')
  if ($local -eq '') { $local = 'index.html' }
  $path = Join-Path $root $local
  if ([System.IO.File]::Exists($path)) {
    $ext = [System.IO.Path]::GetExtension($path)
    $res.ContentType = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $res.Close()
}
