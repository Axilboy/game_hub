/**
 * Общая логика команд для Элиас / Правда или действие (как в типичных party-приложениях):
 * — авто обновляется при смене состава (вход/выход), не трогает ручную расстановку при том же наборе id;
 * — хост вручную перетаскивает по кнопкам команд; «Случайно» и «Авто по списку» — как у конкурентов.
 */

/** Ключ состава для сравнения «тот же набор игроков» */
export function playersIdsKey(players) {
  if (!players?.length) return '';
  return players.map((p) => p.id).sort().join(',');
}

export function teamsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((t, i) => {
    const ta = [...(t.playerIds || [])].sort().join(',');
    const tb = [...(b[i]?.playerIds || [])].sort().join(',');
    return (t.name || '') === (b[i]?.name || '') && ta === tb;
  });
}

/** Две команды: чередование по порядку в лобби (1-й, 3-й… vs 2-й, 4-й…) — ровнее, чем «первая половина списка». */
export function buildTwoTeamsRoundRobin(players) {
  const t1 = [];
  const t2 = [];
  players.forEach((p, i) => {
    if (i % 2 === 0) t1.push(p.id);
    else t2.push(p.id);
  });
  return [
    { name: 'Команда 1', playerIds: t1 },
    { name: 'Команда 2', playerIds: t2 },
  ];
}

/** 3 игрока: две команды 2 + 1 (как в онлайн-Alias / «две команды из троих»). */
export function buildTwoTeamsThreePlayers(players) {
  const ids = players.map((p) => p.id);
  return [
    { name: 'Команда 1', playerIds: ids.slice(0, 2) },
    { name: 'Команда 2', playerIds: ids.slice(2) },
  ];
}

/** 2 игрока: по одному в команде (дуэль). */
export function buildTwoSoloTeams(players) {
  return players.map((p, i) => ({
    name: `Команда ${i + 1}`,
    playerIds: [p.id],
  }));
}

/**
 * Автокоманды по числу игроков (единые правила для Элиас и П/Д).
 * n=2 → 2×1 | n=3 → 2+1 | n≥4 → 2 команды, чередование по списку.
 */
export function buildAutoPartyTeams(players) {
  const n = players?.length ?? 0;
  if (n <= 1) return null;
  if (n === 2) return buildTwoSoloTeams(players);
  if (n === 3) return buildTwoTeamsThreePlayers(players);
  return buildTwoTeamsRoundRobin(players);
}

/** Случайный порядок, затем те же правила, что и в «Авто». */
export function shufflePartyTeams(players) {
  if (!players?.length) return null;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return buildAutoPartyTeams(shuffled);
}
