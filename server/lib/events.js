/* ============================================================
   SmartPlan — мгновенные уведомления об изменениях (22.09-243)
   ------------------------------------------------------------
   Открытые сайты держат с сервером лёгкое постоянное соединение
   (Server-Sent Events, /api/events). После каждого успешного
   изменения данных сервер рассылает всем короткое сообщение
   «изменился раздел X» — сайты сразу забирают новое через
   /api/sync, без опроса каждую секунду.
   ============================================================ */
'use strict';

const clients = new Set();

function add(c) { clients.add(c); }
function remove(c) { clients.delete(c); }
function count() { return clients.size; }

function broadcast(evt) {
  const line = 'event: change\ndata: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) {
    try { c.res.write(line); } catch (e) { /* соединение закрыто — уберётся по 'close' */ }
  }
}

module.exports = { add, remove, count, broadcast };
