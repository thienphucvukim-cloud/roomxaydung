$ErrorActionPreference = 'Stop'
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskNodePath = Join-Path $taskProjectRoot '.sites-runtime\node-v22.16.0-win-x64\node.exe'
if (-not (Test-Path -LiteralPath $taskNodePath)) { $taskNodePath = (Get-Command node.exe -ErrorAction Stop).Source }
$taskScriptPath = Join-Path $PSScriptRoot 'sync-local-cloud-backup.mjs'
$taskHash = [Security.Cryptography.SHA256]::Create()
$taskSuffix = ([BitConverter]::ToString($taskHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($taskProjectRoot)))).Replace('-', '').Substring(0, 12)
$taskHash.Dispose()
$taskName = 'TipookLocalCloudBackup-' + $taskSuffix
$taskAction = New-ScheduledTaskAction -Execute $taskNodePath -Argument ('"' + $taskScriptPath + '"') -WorkingDirectory $taskProjectRoot
$taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description 'Sao luu database localhost len Cloudflare R2 rieng tu moi 5 phut khi du lieu thay doi; chay doc lap voi web.' -Force | Out-Null
Write-Output ('Local cloud backup task installed: ' + $taskName)
