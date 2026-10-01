// === OptMap (github.com/ilyaomelchuk97-rgb/OptMap), порт под CommonJS для SmartPlan.
// === Исходник: optimizer/index.js — логика не менялась, только импорты/экспорты.
// Диспетчер оптимизатора: точный алгоритм для малого числа точек,
// эвристика — для большого.

const { heldKarp } = require('./exact');
const { heuristicTSP } = require('./heuristic');

const EXACT_MAX_N = 12;

/**
 * @param {number[][]} m — матрица стоимостей (время или расстояние)
 * @param {object} opts { roundTrip, endLocked }
 */
function optimizeOrder(m, opts = {}) {
  const n = m.length;
  const t0 = process.hrtime.bigint();
  let res;
  let method;
  if (n <= EXACT_MAX_N) {
    res = heldKarp(m, opts);
    method = 'точный (Хелд-Карп)';
  }
  if (!res) {
    const h = heuristicTSP(m, opts);
    res = { order: h.order, cost: h.cost };
    method = h.method;
    res.elapsedMs = h.elapsedMs;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ...res, method, elapsedMs: Math.round(ms * 10) / 10 };
}

module.exports = { EXACT_MAX_N, optimizeOrder };
