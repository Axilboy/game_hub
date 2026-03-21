/** Классические роли (бесплатно): civilian, mafia, don, commissioner. Расширенные (Про): + doctor, prostitute */
const CLASSIC_ROLES = ['civilian', 'mafia', 'don', 'commissioner'];
const EXTENDED_ROLES = ['civilian', 'mafia', 'don', 'commissioner', 'doctor', 'prostitute'];

const ROLE_NAMES = {
  civilian: 'Мирный',
  mafia: 'Мафия',
  don: 'Дон',
  commissioner: 'Комиссар',
  doctor: 'Доктор',
  prostitute: 'Путана',
};

const THEMES = { default: ROLE_NAMES };

export function getRoleDisplayName(role, themeId = 'default') {
  const theme = THEMES[themeId] || THEMES.default;
  return theme[role] || ROLE_NAMES[role] || role;
}

/** @typedef {'random'|'moderator'|'player_vote'} MafiaRolesMode */

function buildRandomRoleMap(pool, extended) {
  const roles = [...(extended ? EXTENDED_ROLES : CLASSIC_ROLES)];
  const count = pool.length;
  const roleCounts = { civilian: Math.max(1, count - 3), mafia: 1, don: 1, commissioner: 1 };
  if (extended) {
    roleCounts.doctor = 1;
    roleCounts.prostitute = 1;
    roleCounts.civilian = Math.max(0, count - 5);
  }
  const assignment = [];
  for (const [role, num] of Object.entries(roleCounts)) {
    for (let i = 0; i < num; i++) assignment.push(role);
  }
  while (assignment.length < count) assignment.push('civilian');
  while (assignment.length > count) assignment.pop();
  shuffle(assignment);
  const roleMap = {};
  pool.forEach((p, i) => {
    roleMap[p.id] = assignment[i] || 'civilian';
  });
  return roleMap;
}

function baseMafiaPayload(moderatorId, poolIds, roleMap, settings) {
  const {
    extended = false,
    revealRoleOnDeath = true,
    mafiaCanSkipKill = false,
    theme = 'default',
    phaseTimers = null,
    mafiaRolesMode = 'random',
  } = settings;
  return {
    roles: roleMap,
    moderatorId,
    alive: [...poolIds],
    settings: { extended, revealRoleOnDeath, mafiaCanSkipKill, theme, phaseTimers, mafiaRolesMode },
    mafiaVotes: {},
    commissionerCheck: null,
    doctorSave: null,
    nightKill: null,
    dayVotes: {},
    killedTonight: [],
    eliminatedToday: [],
    revealed: [],
    commissionerCheckedId: null,
    phaseStartedAt: Date.now(),
    phaseDurationSec: null,
    roleSetupVotes: {},
  };
}

export function createMafiaState(players, settings = {}) {
  const { moderatorId = null, mafiaRolesMode = 'random' } = settings;
  const pool = players.filter((p) => p.id !== moderatorId);
  const poolIds = pool.map((p) => p.id);

  if (mafiaRolesMode === 'moderator' || mafiaRolesMode === 'player_vote') {
    const out = baseMafiaPayload(moderatorId, poolIds, {}, settings);
    out.roles = {};
    out.phase = mafiaRolesMode === 'moderator' ? 'role_setup_moderator' : 'role_setup_vote';
    out.roleSetupVotes = {};
    return out;
  }

  const roleMap = buildRandomRoleMap(pool, settings.extended);
  const out = baseMafiaPayload(moderatorId, poolIds, roleMap, { ...settings, mafiaRolesMode: 'random' });
  out.phase = 'night_mafia';
  return out;
}

/**
 * Ведущий назначает роли вручную (классика: дон, мафия, комиссар; расширение: +доктор, путана).
 */
export function assignRolesFromModeratorPicks({
  poolIds,
  donId,
  mafiaId,
  commissionerId,
  doctorId,
  prostituteId,
  extended,
}) {
  const need = extended
    ? [donId, mafiaId, commissionerId, doctorId, prostituteId]
    : [donId, mafiaId, commissionerId];
  const s = new Set(need.map(String));
  if (s.size !== need.length) return { error: 'Все назначения должны быть разными игроками' };
  for (const id of need) {
    if (!poolIds.some((x) => String(x) === String(id))) return { error: 'Игрок не в составе' };
  }
  const roleMap = {};
  roleMap[String(donId)] = 'don';
  roleMap[String(mafiaId)] = 'mafia';
  roleMap[String(commissionerId)] = 'commissioner';
  if (extended) {
    roleMap[String(doctorId)] = 'doctor';
    roleMap[String(prostituteId)] = 'prostitute';
  }
  for (const id of poolIds) {
    const k = String(id);
    if (!roleMap[k]) roleMap[k] = 'civilian';
  }
  return { roleMap };
}

function pickTwoOthersFromPool(poolIds, selfId) {
  const others = shuffle(poolIds.filter((id) => String(id) !== String(selfId)));
  if (others.length >= 2) return [others[0], others[1]];
  if (others.length === 1) return [others[0], others[0]];
  return [];
}

/**
 * Итог голосования «кто в мафии»: у каждого игрока 2 номинации; топ-2 — дон+мафия, комиссар и остальные — случайно из оставшихся.
 */
export function assignRolesFromPlayerVotes(gs) {
  const poolIds = [...(gs.alive || [])];
  const extended = !!gs.settings?.extended;
  const votes = { ...(gs.roleSetupVotes || {}) };

  for (const id of poolIds) {
    if (votes[id] != null) continue;
    const auto = pickTwoOthersFromPool(poolIds, id);
    if (auto.length === 2) votes[id] = auto;
  }

  const tally = {};
  for (const id of poolIds) {
    const t = votes[id];
    if (!Array.isArray(t) || t.length < 2) continue;
    const a = String(t[0]);
    const b = String(t[1]);
    const targets = a === b ? [a] : [a, b];
    for (const target of targets) {
      if (!poolIds.some((x) => String(x) === target)) continue;
      if (String(target) === String(id)) continue;
      tally[target] = (tally[target] || 0) + 1;
    }
  }

  const sorted = poolIds.slice().sort((x, y) => (tally[String(y)] || 0) - (tally[String(x)] || 0));
  const first = sorted[0];
  const second = sorted.find((id) => String(id) !== String(first)) || sorted[1];
  if (first == null || second == null) return { error: 'Недостаточно игроков для голосования' };

  const roleMap = {};
  const swap = Math.random() < 0.5;
  roleMap[String(first)] = swap ? 'don' : 'mafia';
  roleMap[String(second)] = swap ? 'mafia' : 'don';

  const mafiaTeam = new Set([String(first), String(second)]);
  const rest = poolIds.filter((id) => !mafiaTeam.has(String(id)));
  if (rest.length === 0) return { error: 'Некорректный состав' };

  const commissioner = rest[Math.floor(Math.random() * rest.length)];
  roleMap[String(commissioner)] = 'commissioner';

  const rest2 = rest.filter((id) => String(id) !== String(commissioner));
  if (extended) {
    if (rest2.length < 2) return { error: 'Недостаточно игроков для расширенных ролей' };
    const doctor = rest2[Math.floor(Math.random() * rest2.length)];
    roleMap[String(doctor)] = 'doctor';
    const rest3 = rest2.filter((id) => String(id) !== String(doctor));
    const prostitute = rest3[Math.floor(Math.random() * rest3.length)];
    roleMap[String(prostitute)] = 'prostitute';
  }

  for (const id of poolIds) {
    const k = String(id);
    if (!roleMap[k]) roleMap[k] = 'civilian';
  }

  return { roleMap, votes };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function getMafiaPlayers(roles) {
  return Object.entries(roles || {}).filter(([, r]) => r === 'mafia' || r === 'don').map(([id]) => id);
}

export function resolveNight(gs, players) {
  const gsCopy = { ...gs, mafiaVotes: { ...gs.mafiaVotes }, commissionerCheck: gs.commissionerCheck, doctorSave: gs.doctorSave };
  const votes = {};
  for (const id of getMafiaPlayers(gs.roles)) {
    const v = gs.mafiaVotes[id];
    if (v) votes[v] = (votes[v] || 0) + 1;
  }
  let max = 0, target = null;
  for (const [id, c] of Object.entries(votes)) if (c > max) { max = c; target = id; }
  const aliveSet = new Set(gs.alive);
  if (!target && !gs.settings.mafiaCanSkipKill) {
    const mafiaIds = getMafiaPlayers(gs.roles);
    const aliveMafia = mafiaIds.filter((id) => aliveSet.has(id));
    if (aliveMafia.length) target = aliveMafia[Math.floor(Math.random() * aliveMafia.length)];
  }
  const killed = target && target !== gs.doctorSave ? target : null;
  gsCopy.nightKill = killed;
  gsCopy.killedTonight = killed ? [killed] : [];
  if (killed) {
    aliveSet.delete(killed);
    gsCopy.alive = [...aliveSet];
    if (gs.settings.revealRoleOnDeath) gsCopy.revealed = [...(gs.revealed || []), { id: killed, role: gs.roles[killed] }];
  }
  gsCopy.phase = 'day';
  gsCopy.mafiaVotes = {};
  gsCopy.commissionerCheck = null;
  gsCopy.doctorSave = null;
  return gsCopy;
}

export function resolveDayVote(gs) {
  const aliveSet = new Set(gs.alive);
  const votes = {};
  for (const [voter, target] of Object.entries(gs.dayVotes || {})) {
    if (aliveSet.has(voter) && aliveSet.has(target)) votes[target] = (votes[target] || 0) + 1;
  }
  let max = 0, out = null;
  for (const [id, c] of Object.entries(votes)) if (c > max) { max = c; out = id; }
  const gsCopy = { ...gs, dayVotes: {}, eliminatedToday: out ? [out] : [] };
  if (out) {
    aliveSet.delete(out);
    gsCopy.alive = [...aliveSet];
    if (gs.settings.revealRoleOnDeath) gsCopy.revealed = [...(gs.revealed || []), { id: out, role: gs.roles[out] }];
  }
  gsCopy.phase = 'night_mafia';
  return gsCopy;
}

export function checkWin(gs) {
  if (!gs.roles || Object.keys(gs.roles).length === 0) return null;
  if (String(gs.phase || '').startsWith('role_setup')) return null;
  const aliveSet = new Set(gs.alive);
  const mafiaIds = getMafiaPlayers(gs.roles);
  const aliveMafia = mafiaIds.filter((id) => aliveSet.has(id));
  const aliveCivilians = gs.alive.filter((id) => !mafiaIds.includes(id));
  if (aliveMafia.length === 0) return 'civilians';
  if (aliveMafia.length >= aliveCivilians.length) return 'mafia';
  return null;
}

export function toClientState(gs, playerId, players) {
  const aliveList = (gs.alive || []).map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const rawRole = gs.roles ? gs.roles[playerId] : null;
  const myRole = rawRole || null;
  const isModerator = gs.moderatorId === playerId;
  const mafiaIds = getMafiaPlayers(gs.roles || {});
  const theme = gs.settings?.theme || 'default';
  const getPlayerName = (id) => players.find((p) => p.id === id)?.name || id;
  const poolIds = gs.alive || [];
  const roleSetupVotes = gs.roleSetupVotes && typeof gs.roleSetupVotes === 'object' ? gs.roleSetupVotes : {};
  const roleSetupVotedCount = poolIds.filter((id) => roleSetupVotes[id] != null).length;
  const mySetupVote = roleSetupVotes[playerId];
  const publicInfo = {
    phase: gs.phase,
    phaseStartedAt: gs.phaseStartedAt || null,
    phaseDurationSec: Number(gs.phaseDurationSec) || null,
    alive: aliveList.map((p) => ({ id: p.id, name: p.name })),
    killedTonight: (gs.killedTonight || []).map((id) => ({ id, name: getPlayerName(id) })),
    eliminatedToday: (gs.eliminatedToday || []).map((id) => ({ id, name: getPlayerName(id) })),
    revealed: (gs.revealed || []).map((r) => ({ id: r.id, role: getRoleDisplayName(r.role, theme) })),
    commissionerCheckedId: gs.commissionerCheckedId || null,
    settings: gs.settings,
    rolesReady: Object.keys(gs.roles || {}).length > 0,
    roleSetupVotedCount,
    roleSetupTotal: poolIds.length,
    myRoleSetupTargets: Array.isArray(mySetupVote) ? mySetupVote : null,
  };
  const dayVotes = gs.dayVotes && typeof gs.dayVotes === 'object' ? gs.dayVotes : {};
  const voteCounts = {};
  for (const targetId of Object.values(dayVotes)) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }
  let roleForPlayer = null;
  if (myRole) roleForPlayer = { role: myRole, roleName: getRoleDisplayName(myRole, theme) };
  if (mafiaIds.includes(playerId)) {
    const mafiaTeammates = mafiaIds.filter((id) => id !== playerId).map((id) => players.find((p) => p.id === id)).filter(Boolean);
    return {
      ...publicInfo,
      myRole: roleForPlayer,
      mafiaTeammates: mafiaTeammates.map((p) => ({ id: p.id, name: p.name })),
      isModerator,
      dayVotes,
      voteCounts,
    };
  }
  return { ...publicInfo, myRole: roleForPlayer, isModerator, dayVotes, voteCounts };
}

export { ROLE_NAMES, THEMES, CLASSIC_ROLES, EXTENDED_ROLES };
