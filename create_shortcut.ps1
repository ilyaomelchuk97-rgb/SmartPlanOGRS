# SmartPlan Демо — установщик ярлыка (PowerShell)
# Используется батником install_demo_shortcut.bat
#
# Вызов (для BAT-файла с уже найденным браузером):
#   powershell -NoProfile -ExecutionPolicy Bypass -File create_shortcut.ps1 `
#     -ShortcutPath "C:\Users\X\Desktop\SmartPlan Демо.lnk" `
#     -BrowserPath "C:\Program Files\...\msedge.exe" `
#     -IndexHtmlPath "C:\path\index_demo.html" `
#     -WorkingDirectory "C:\path" `
#     -IconPath "C:\path\root_index\icon-192.png"
#
# Вызов (если браузер НЕ найден — откройте index.html напрямую):
#   powershell -NoProfile -ExecutionPolicy Bypass -File create_shortcut.ps1 `
#     -ShortcutPath "C:\Users\X\Desktop\SmartPlan Демо.lnk" `
#     -IndexHtmlPath "C:\path\index_demo.html" `
#     -WorkingDirectory "C:\path" `
#     -IconPath "C:\path\root_index\icon-192.png"
#
# Скрипт сам формирует аргумент "--app=<путь>" с правильным экранированием
# (пробелы в пути обрамляются кавычками внутри значения Arguments).

param (
    [Parameter(Mandatory=$true)][string]$ShortcutPath,
    [Parameter(Mandatory=$true)][string]$IndexHtmlPath,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [string]$BrowserPath = "",
    [string]$IconPath = ""
)

$ErrorActionPreference = 'Stop'

try {
    $shell = New-Object -COM WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)

    if ($BrowserPath -ne "" -and $null -ne $BrowserPath) {
        # Браузер указан — открываем через него в режиме --app=...
        $shortcut.TargetPath = $BrowserPath
        # Формируем аргумент: --app="<путь>" (с кавычками вокруг пути если есть пробелы)
        $shortcut.Arguments = '--app=' + $IndexHtmlPath
    } else {
        # Браузер не указан — ярлык просто на .html, Windows откроет в браузере по умолчанию
        $shortcut.TargetPath = $IndexHtmlPath
    }

    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.WindowStyle = 1   # 1 = SW_SHOWNORMAL (обычное окно)
    $shortcut.Description = 'SmartPlan Демо — локальная версия без интернета'
    if ($IconPath -ne "") {
        $shortcut.IconLocation = $IconPath + ',0'
    }
    $shortcut.Save()

    Write-Host ("OK: target=" + $shortcut.TargetPath)
    Write-Host ("    args=" + $shortcut.Arguments)
    Write-Host ("    icon=" + $shortcut.IconLocation)
    exit 0
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message)
    exit 1
}