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

/** Минимум игроков за столом (ведущий в состав не входит). Комфортный стол — от 6. */
export const MIN_MAFIA_PLAYERS_CLASSIC = 6;
export const MIN_MAFIA_PLAYERS_EXTENDED = 6;

/**
 * Состав ролей от числа играющих n (ведущий не считается).
 * Классика: дон ×1, «мафия» ×k, комиссар ×1, мирные — остальные.
 * k = 1 + ⌊(n − 4) / 3⌋ → при росте стола мафия увеличивается ступенями (~каждые 3 игрока +1 мафия).
 * Расширение: + доктор, + путана; мирные = n − 4 − k (нужно n ≥ 6).
 */
export function computeRoleComposition(playerCount, extended) {
  const n = playerCount;
  if (n < MIN_MAFIA_PLAYERS_CLASSIC) {
    return { ok: false, error: `Нужно минимум ${MIN_MAFIA_PLAYERS_CLASSIC} игрока за столом (без ведущего)` };
  }
  const mafia = Math.floor((n - 4) / 3) + 1;
  if (!extended) {
    const civilian = n - 2 - mafia;
    if (civilian < 1) return { ok: false, error: 'Некорректный состав для классики' };
    return {
      ok: true,
      extended: false,
      don: 1,
      mafia,
      commissioner: 1,
      doctor: 0,
      prostitute: 0,
      civilian,
    };
  }
  if (n < MIN_MAFIA_PLAYERS_EXTENDED) {
    return {
      ok: false,
      error: `Расширенная мафия: минимум ${MIN_MAFIA_PLAYERS_EXTENDED} игроков за столом (без ведущего)`,
    };
  }
  const civilian = n - 4 - mafia;
  if (civilian < 0) {
    return { ok: false, error: 'Недостаточно игроков для расширенных ролей' };
  }
  return {
    ok: true,
    extended: true,
    don: 1,
    mafia,
    commissioner: 1,
    doctor: 1,
    prostitute: 1,
    civilian,
  };
}

function buildRandomRoleMap(pool, extended) {
  const comp = computeRoleComposition(pool.length, extended);
  if (!comp.ok) {
    const assignment = Array.from({ length: pool.length }, () => 'civilian');
    const roleMap = {};
    pool.forEach((p, i) => {
      roleMap[p.id] = assignment[i];
    });
    return roleMap;
  }
  const assignment = [];
  assignment.push('don');
  for (let i = 0; i < comp.mafia; i++) assignment.push('mafia');
  assignment.push('commissioner');
  if (comp.extended) {
    assignment.push('doctor');
    assignment.push('prostitute');
  }
  for (let i = 0; i < comp.civilian; i++) assignment.push('civilian');
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
    killNightEnabled: false,
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
  out.phase = 'prep_day_1';
  out.killNightEnabled = false;
  return out;
}

/**
 * Ведущий назначает роли вручную.
 * mafiaIds — массив id игроков в роли «мафия» (длина = computeRoleComposition(...).mafia).
 * Поддержка legacy: одно поле mafiaId → [mafiaId].
 */
export function assignRolesFromModeratorPicks({
  poolIds,
  donId,
  mafiaIds: mafiaIdsRaw,
  mafiaId: legacyMafiaId,
  commissionerId,
  doctorId,
  prostituteId,
  extended,
}) {
  const comp = computeRoleComposition(poolIds.length, extended);
  if (!comp.ok) return { error: comp.error };

  let mafiaIds = Array.isArray(mafiaIdsRaw) ? mafiaIdsRaw : legacyMafiaId != null ? [legacyMafiaId] : [];
  mafiaIds = mafiaIds.map((id) => String(id));
  if (mafiaIds.length !== comp.mafia) {
    return { error: `Нужно назначить ровно ${comp.mafia} игрок(а/ов) в роль «Мафия» (не считая дона)` };
  }
  const mSet = new Set(mafiaIds);
  if (mSet.size !== mafiaIds.length) return { error: 'Все мафии должны быть разными игроками' };

  const need = [donId, commissionerId, ...mafiaIds];
  if (extended) need.push(doctorId, prostituteId);
  const s = new Set(need.map(String));
  if (s.size !== need.length) return { error: 'Все назначения должны быть разными игроками' };
  for (const id of need) {
    if (!poolIds.some((x) => String(x) === String(id))) return { error: 'Игрок не в составе' };
  }

  const roleMap = {};
  roleMap[String(donId)] = 'don';
  for (const mid of mafiaIds) roleMap[String(mid)] = 'mafia';
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
 * Итог голосования: у каждого 2 номинации; по очкам выбираем (1 + k) человек в команду мафии (дон + k мафий),
 * дон случайно среди них, остальные — мафия; комиссар и пр. — случайно из оставшихся по правилам состава.
 */
export function assignRolesFromPlayerVotes(gs) {
  const poolIds = [...(gs.alive || [])];
  const extended = !!gs.settings?.extended;
  const comp = computeRoleComposition(poolIds.length, extended);
  if (!comp.ok) return { error: comp.error };

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

  const mafiaTeamSize = 1 + comp.mafia;
  const sorted = poolIds.slice().sort((x, y) => {
    const d = (tally[String(y)] || 0) - (tally[String(x)] || 0);
    if (d !== 0) return d;
    return String(x).localeCompare(String(y));
  });

  const mafiaTeamIds = [];
  const seen = new Set();
  for (const id of sorted) {
    if (mafiaTeamIds.length >= mafiaTeamSize) break;
    const k = String(id);
    if (seen.has(k)) continue;
    seen.add(k);
    mafiaTeamIds.push(id);
  }
  if (mafiaTeamIds.length < mafiaTeamSize) return { error: 'Недостаточно кандидатов для состава мафии' };

  const donPick = mafiaTeamIds[Math.floor(Math.random() * mafiaTeamIds.length)];
  const roleMap = {};
  roleMap[String(donPick)] = 'don';
  for (const id of mafiaTeamIds) {
    if (String(id) === String(donPick)) continue;
    roleMap[String(id)] = 'mafia';
  }

  const rest = poolIds.filter((id) => !mafiaTeamIds.some((m) => String(m) === String(id)));
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
  const aliveCivilians = gs.alive.filter((id) => !mafiaIds.some((m) => String(m) === String(id)));
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
  const comp = computeRoleComposition(poolIds.length, !!gs.settings?.extended);
  const roleSetupExpect = comp.ok
    ? {
        playersInGame: poolIds.length,
        extended: !!gs.settings?.extended,
        mafiaCount: comp.mafia,
        civilianCount: comp.civilian,
        hasDoctor: !!comp.extended,
        hasProstitute: !!comp.extended,
      }
    : null;

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
    roleSetupExpect,
    /** false — подготовка до 2-й ночи; undefined (старые сохранения) — считать разрешённым */
    killNightEnabled: gs.killNightEnabled !== false,
  };
  const dayVotes = gs.dayVotes && typeof gs.dayVotes === 'object' ? gs.dayVotes : {};
  const voteCounts = {};
  for (const targetId of Object.values(dayVotes)) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }
  let roleForPlayer = null;
  if (myRole) roleForPlayer = { role: myRole, roleName: getRoleDisplayName(myRole, theme) };
  if (mafiaIds.some((id) => String(id) === String(playerId))) {
    const mafiaTeammates = mafiaIds.filter((id) => String(id) !== String(playerId)).map((id) => players.find((p) => String(p.id) === String(id))).filter(Boolean);
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
