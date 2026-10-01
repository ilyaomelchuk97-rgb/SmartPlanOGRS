# OptMap для SmartPlan (свой оптимизатор маршрутов)

Перенесено из https://github.com/ilyaomelchuk97-rgb/OptMap (порт ES-модулей в
CommonJS под наш сервер). Содержит:

- `engine/` — граф дорог, привязка точек к дорогам, поиск пути (A*), матрица
  времени/дистанций, модель пробок по часу выезда;
- `optimizer/` — оптимизатор порядка точек: точный Хелд-Карп (≤12 точек),
  дальше NN + 2-opt + Or-opt (мультистарт, до 50 точек);
- `util/` — геодезия, бинарная куча;
- `data/graph.bin.gz` — дорожный граф **Минска и ближайших пригородов**
  (bbox 53.66–54.16, 27.20–28.08; Geofabrik, срез 2026-09-30):
  370 448 узлов, 740 263 рёбер, бинарный формат OPTG1BIN (~17 МБ).
  Бинарный — потому что JSON-версия при загрузке съедала ~500 МБ пиковой
  памяти и роняла Render free (502). Собирается из исходного graph.json.gz
  скриптом `scripts/pack-graph.js`.

Отличия порта от исходного репозитория:
1. Исходники переведены на `require/module.exports` (наш сервер — CommonJS).
2. Убраны внешние адаптеры (OSRM/Яндекс/Nominatim), тайл-прокси, демо-страницы
   и генератор синтетического города — работает только локальный граф OSM.
3. `engine/graph.js`: загрузка графа — в типизированные массивы (память ~200 МБ
   вместо ~500), исправлен `Math.max(...kmh)` (переполнял стек на большом графе)
   и множитель в `reverseOf` (2^24 → 2^32, как в `edgeKey`).
4. В исходном `engine/ingest-osm.js` были обрывки строк в конце файла
   (`SyntaxError: Illegal return statement`) — при переносе исправлено;
   сам инжест сюда не переносился (граф собирается офлайн, см. ниже).

## Использование

Роуты `server/routes/optmap.js` монтируются как `/api/optmap` (авторизация +
роль admin — страница «Тест проезда»):

- `GET /api/optmap/health` — статус (узлы/рёбра, bbox, профиль пробок);
- `POST /api/optmap/optimize` — `{ points:[{lat,lon(lng),name}], options:
  {roundTrip, mode:'time', traffic, departHour, returnGeometry} }` →
  `{ order, legs[{from,to,distanceM,durationS,avgSpeedKmh,coords}], totals
  {distanceM,durationS,freeFlowDurationS,directDistanceM,detourFactor},
  optimizer{method,…}, warnings[] }`;
- `POST /api/optmap/route` — маршрут между двумя точками.

## Как обновить дорожный граф

1. Скачать свежий `belarus-latest.osm.pbf` с download.geofabrik.de;
2. Вырезать bbox Минска (скрипт на pyosmium — как в сессии 22.09-128);
3. В клоне OptMap: `node --stack-size=16000 scripts/ingest.js --pbf minsk-box.osm.pbf
   --out data/graph.json.gz`;
4. Упаковать в бинарный формат: `node server/optmap/scripts/pack-graph.js
   graph.json.gz server/optmap/data/graph.bin.gz`, закоммитить, задеплоить.
