$BundledPython = "C:\Users\kodur\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ProjectRoot

if (Test-Path $BundledPython) {
  & $BundledPython "$ProjectRoot\server.py"
} else {
  python "$ProjectRoot\server.py"
}
