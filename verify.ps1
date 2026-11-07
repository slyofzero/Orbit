# Runs the checks and build, and saves everything to verify-log.txt so Claude can read it.
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "verify-log.txt"
"=== $(Get-Date) ===" | Out-File $log -Encoding utf8
function Step($name, $cmd) {
  "`n--- $name ---" | Tee-Object -FilePath $log -Append
  & cmd /c "$cmd 2>&1" | Tee-Object -FilePath $log -Append
  "exit code: $LASTEXITCODE" | Tee-Object -FilePath $log -Append
}
Step "type check" "bunx tsc --noEmit"
Step "tests" "bun run check"
Step "build" "bun run build"
"`nDONE. Tell Claude it finished." | Tee-Object -FilePath $log -Append
