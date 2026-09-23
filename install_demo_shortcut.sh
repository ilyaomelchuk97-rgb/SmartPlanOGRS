#!/usr/bin/env bash
# SmartPlan Демо — установщик ярлыка (macOS/Linux)
# Запускать из КОРНЯ проекта (там, где лежит index_demo.html)

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║  SmartPlan ДЕМО — автономная версия (без интернета/сервера) ║"
echo "  ║  Установка ярлыка                                           ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "  Проект: ${SCRIPT_DIR}"

if [ ! -f "${SCRIPT_DIR}/index_demo.html" ]; then
  echo -e "${RED}[ОШИБКА] Не найден index_demo.html. Положите install_demo_shortcut.sh в корень проекта.${NC}"
  exit 1
fi
if [ ! -d "${SCRIPT_DIR}/root_index" ]; then
  echo -e "${RED}[ОШИБКА] Не найдена папка root_index/.${NC}"
  exit 1
fi

# === macOS ===
if [[ "$OSTYPE" == "darwin"* ]]; then
  DESKTOP="${HOME}/Desktop"
  APP_NAME="SmartPlan Demo"
  APP_DIR="${DESKTOP}/${APP_NAME}.app"
  echo -e "  Рабочий стол: ${DESKTOP}"
  echo -e "  Создаю .app-бандл..."

  mkdir -p "${APP_DIR}/Contents/MacOS"
  mkdir -p "${APP_DIR}/Contents/Resources"

  # Info.plist
  cat > "${APP_DIR}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key><string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>local.mingaz.smartplandemo</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launch</string>
</dict>
</plist>
EOF

  # launcher — открывает index_demo.html в Safari (или Chrome если есть)
  cat > "${APP_DIR}/Contents/MacOS/launch" <<EOF
#!/usr/bin/env bash
DIR="${SCRIPT_DIR}"
URL="file://\${DIR}/index_demo.html"
# Сначала пробуем Chrome (полноэкранный app-режим), иначе — Safari
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="\${URL}" --window-size=1400,900
else
  exec /usr/bin/open -a Safari "\${URL}"
fi
EOF
  chmod +x "${APP_DIR}/Contents/MacOS/launch"

  # Копируем иконку (если есть .icns) — иначе используем png
  if [ -f "${SCRIPT_DIR}/root_index/icon-512.png" ]; then
    # Конвертируем PNG → ICNS (если есть sips)
    if command -v sips >/dev/null 2>&1; then
      ICONSET=$(mktemp -d)/icon.iconset
      mkdir -p "\${ICONSET}"
      sips -z 16 16   "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_16x16.png"   >/dev/null
      sips -z 32 32   "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_16x16@2x.png" >/dev/null
      sips -z 32 32   "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_32x32.png"   >/dev/null
      sips -z 64 64   "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_32x32@2x.png" >/dev/null
      sips -z 128 128 "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_128x128.png" >/dev/null
      sips -z 256 256 "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_128x128@2x.png" >/dev/null
      sips -z 256 256 "${SCRIPT_DIR}/root_index/icon-192.png" --out "\${ICONSET}/icon_256x256.png" >/dev/null
      sips -z 512 512 "${SCRIPT_DIR}/root_index/icon-512.png" --out "\${ICONSET}/icon_256x256@2x.png" >/dev/null
      sips -z 512 512 "${SCRIPT_DIR}/root_index/icon-512.png" --out "\${ICONSET}/icon_512x512.png" >/dev/null
      iconutil -c icns "\${ICONSET}" -o "${APP_DIR}/Contents/Resources/icon.icns"
      rm -rf "\${ICONSET}"
    fi
  fi

  echo -e "${GREEN}"
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║  ✓ Готово! На рабочем столе: SmartPlan Demo.app             ║"
  echo "  ║                                                              ║"
  echo "  ║  Двойной клик запустит index_demo.html в Chrome/Safari.      ║"
  echo "  ║  Вход: admin/admin123, master/master123, slesar/slesar123    ║"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

# === Linux ===
else
  DESKTOP="${HOME}/Desktop"
  SHORTCUT_FILE="${DESKTOP}/SmartPlan Демо.desktop"
  echo "  Рабочий стол: ${DESKTOP}"
  echo "  Создаю .desktop-файл..."

  # Пробуем найти браузер
  BROWSER=""
  for b in google-chrome chromium chromium-browser firefox; do
    if command -v "${b}" >/dev/null 2>&1; then BROWSER="${b}"; break; fi
  done

  if [ -z "${BROWSER}" ]; then
    BROWSER="xdg-open"
  fi

  cat > "${SHORTCUT_FILE}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=SmartPlan Демо
Name[ru]=SmartPlan Демо
GenericName=SmartPlan Demo (offline)
Comment=SmartPlan Демо — локальная версия без интернета
Comment[ru]=Локальная автономная версия SmartPlan (без сервера)
Exec=${BROWSER} "file://${SCRIPT_DIR}/index_demo.html"
Path=${SCRIPT_DIR}
Icon=${SCRIPT_DIR}/root_index/icon-192.png
Terminal=false
StartupNotify=true
StartupWMClass=SmartPlan Demo
Categories=Office;Utility;
EOF
  chmod +x "${SHORTCUT_FILE}"

  echo -e "${GREEN}"
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║  ✓ Готово! На рабочем столе: SmartPlan Демо.desktop          ║"
  echo "  ║                                                              ║"
  echo "  ║  Двойной клик запустит index_demo.html в ${BROWSER}"
  echo "  ║  Вход: admin/admin123, master/master123, slesar/slesar123    ║"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
fi