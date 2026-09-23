@echo off
chcp 65001 >nul
title SmartPlan Демо — установщик ярлыка
color 0B
echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║  SmartPlan ДЕМО — автономная версия (без интернета/сервера) ║
echo  ║  Установка ярлыка на рабочий стол                           ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

REM === Проверяем что index_demo.html существует рядом с bat-файлом ===
set "SCRIPT_DIR=%~dp0"
if not exist "%SCRIPT_DIR%index_demo.html" (
  echo  [ОШИБКА] Не найден файл index_demo.html рядом с установщиком.
  echo  Положите install_demo_shortcut.bat В КОРЕНЬ проекта SmartPlan,
  echo  рядом с index_demo.html.
  echo.
  pause
  exit /b 1
)

if not exist "%SCRIPT_DIR%root_index" (
  echo  [ОШИБКА] Не найдена папка root_index\ рядом с установщиком.
  echo  Положите install_demo_shortcut.bat В КОРЕНЬ проекта SmartPlan.
  echo.
  pause
  exit /b 1
)

REM === Получаем путь к рабочему столу текущего пользователя ===
set "DESKTOP=%USERPROFILE%\Desktop"
echo  Рабочий стол: %DESKTOP%
echo  Проект:       %SCRIPT_DIR%
echo.

REM === Имя ярлыка (можно поменять) ===
set "SHORTCUT_NAME=SmartPlan Демо"
set "SHORTCUT_FILE=%DESKTOP%\%SHORTCUT_NAME%.lnk"
set "PS1_HELPER=%SCRIPT_DIR%create_shortcut.ps1"

REM === Проверяем что PS1-скрипт есть рядом с bat-файлом ===
if not exist "%PS1_HELPER%" (
  echo  [ОШИБКА] Не найден create_shortcut.ps1 рядом с bat-файлом.
  echo  Убедитесь что оба файла (install_demo_shortcut.bat и create_shortcut.ps1)
  echo  лежат в одной папке рядом с index_demo.html.
  echo.
  pause
  exit /b 1
)

REM === Удаляем старый ярлык если есть ===
if exist "%SHORTCUT_FILE%" (
  echo  Ярлык "%SHORTCUT_NAME%.lnk" уже есть на рабочем столе.
  echo  Удаляю старый...
  del /f /q "%SHORTCUT_FILE%" >nul 2>&1
)

REM === Определяем браузер (приоритет: Edge > Chrome > Firefox > ничего) ===
set "BROWSER_PATH="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if "%BROWSER_PATH%"=="" if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if "%BROWSER_PATH%"=="" if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if "%BROWSER_PATH%"=="" if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if "%BROWSER_PATH%"=="" if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" set "BROWSER_PATH=%ProgramFiles%\Mozilla Firefox\firefox.exe"

if not "%BROWSER_PATH%"=="" (
  echo  Браузер: %BROWSER_PATH%
) else (
  echo  Браузер: ^(по умолчанию в Windows^)
)

echo.
echo  Создаю ярлык "%SHORTCUT_NAME%.lnk"...
echo.

REM === Вызываем PowerShell-скрипт через -File ===
REM  Передаём пути отдельными параметрами — никаких проблем с пробелами и кавычками.
if not "%BROWSER_PATH%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_HELPER%" -ShortcutPath "%SHORTCUT_FILE%" -BrowserPath "%BROWSER_PATH%" -IndexHtmlPath "%SCRIPT_DIR%index_demo.html" -WorkingDirectory "%SCRIPT_DIR%" -IconPath "%SCRIPT_DIR%root_index\icon-192.png"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_HELPER%" -ShortcutPath "%SHORTCUT_FILE%" -IndexHtmlPath "%SCRIPT_DIR%index_demo.html" -WorkingDirectory "%SCRIPT_DIR%" -IconPath "%SCRIPT_DIR%root_index\icon-192.png"
)

if exist "%SHORTCUT_FILE%" (
  echo.
  echo  ╔══════════════════════════════════════════════════════════════╗
  echo  ║  ✓ Готово! Ярлык создан на рабочем столе.                  ║
  echo  ║  Имя:  SmartPlan Демо.lnk                                  ║
  echo  ╚══════════════════════════════════════════════════════════════╝
  echo.
  echo  Двойной клик по ярлыку откроет демо-версию в браузере.
  echo.
  echo  Вход:  admin / admin123
  echo         master / master123
  echo         slesar / slesar123
  echo.
) else (
  echo.
  echo  [ОШИБКА] Не удалось создать ярлык.
  echo.
  echo  Возможные причины:
  echo    1. Нет прав на запись в %DESKTOP%
  echo    2. PowerShell заблокирован политикой
  echo    3. Антивирус блокирует создание .lnk
  echo.
  echo  Обходное решение: создайте ярлык вручную —
  echo    Правый клик по index_demo.html -^> Отправить -^> Рабочий стол (создать ярлык)
  echo.
)

pause