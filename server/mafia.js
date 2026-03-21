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

/** Минимум игроков за столом (ведущий в состав не входит). Как у популярных правил клубов / приложений — от 6. */
export const MIN_MAFIA_PLAYERS_CLASSIC = 6;
export const MIN_MAFIA_PLAYERS_EXTENDED = 6;

/**
 * Состав ролей от числа играющих n (ведущий не считается).
 * Баланс в духе конкурентов (турнирные столы, Mafia Lab: «≈ четверть стола — мафия»):
 * команда мафии (дон + «рядовые») = ⌈n/4⌉, комиссар ×1, мирные — остаток.
 * Расширение: доктор и путана вместо двух мирных.
 */
export function computeRoleComposition(playerCount, extended) {
  const n = playerCount;
  if (n < MIN_MAFIA_PLAYERS_CLASSIC) {
    return { ok: false, error: `Нужно минимум ${MIN_MAFIA_PLAYERS_CLASSIC} игроков за столом (без ведущего)` };
  }
  const blackTotal = Math.ceil(n / 4);
  const mafia = blackTotal - 1;
  if (mafia < 1) {
    return { ok: false, error: 'Некорректный состав ролей' };
  }
  if (!extended) {
    const civilian = n - blackTotal - 1;
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
  const civilian = n - blackTotal - 1 - 2;
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
    mafiaNightMode = 'players',
    commissionerNightMode = 'players',
    doctorNightMode = 'players',
    prostituteNightMode = 'players',
  } = settings;
  return {
    roles: roleMap,
    moderatorId,
    alive: [...poolIds],
    settings: {
      extended,
      revealRoleOnDeath,
      mafiaCanSkipKill,
      theme,
      phaseTimers,
      mafiaRolesMode,
      /** players — роль жмёт игрок; moderator — только ведущий на своём экране */
      mafiaNightMode: mafiaNightMode === 'moderator' ? 'moderator' : 'players',
      commissionerNightMode: commissionerNightMode === 'moderator' ? 'moderator' : 'players',
      doctorNightMode: doctorNightMode === 'moderator' ? 'moderator' : 'players',
      prostituteNightMode: prostituteNightMode === 'moderator' ? 'moderator' : 'players',
    },
    mafiaVotes: {},
    commissionerCheck: null,
    doctorSave: null,
    prostituteVisit: null,
    nightKill: null,
    dayVotes: {},
    killedTonight: [],
    eliminatedToday: [],
    revealed: [],
    /** Приватная проверка комиссара (только для комиссара в toClientState), не для общего стола */
    commissionerPrivate: null,
    /** Итог ночи до оглашений ведущим */
    pendingNight: null,
    /** Уже оглашено всем столом (доктор/путана) */
    publicDawn: {},
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

  /** Ведущий/голосование за роли — только после первого подготовительного дня (как в правилах стола). */
  if (mafiaRolesMode === 'moderator' || mafiaRolesMode === 'player_vote') {
    const out = baseMafiaPayload(moderatorId, poolIds, {}, settings);
    out.roles = {};
    out.phase = 'prep_day_1';
    out.killNightEnabled = false;
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
 * Итог голосования за состав: у каждого 1 или 2 номинации (два — как раньше);
 * по очкам выбираем (1 + k) человек в команду мафии. Если голосов нет — случайная раздача.
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
    if (t == null) continue;
    const arr = Array.isArray(t) ? t : [t];
    if (arr.length === 0) continue;
    const a = String(arr[0]);
    const b = arr.length >= 2 ? String(arr[1]) : null;
    const targets = b && a !== b ? [a, b] : [a];
    for (const target of targets) {
      if (!poolIds.some((x) => String(x) === target)) continue;
      if (String(target) === String(id)) continue;
      tally[target] = (tally[target] || 0) + 1;
    }
  }

  if (Object.keys(tally).length === 0) {
    const fakePool = poolIds.map((id) => ({ id }));
    const roleMap = buildRandomRoleMap(fakePool, extended);
    return { roleMap, votes };
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

/**
 * Подсчёт цели мафии и эффективного убийства (с учётом доктора) — без изменения alive.
 */
function computeMafiaNightTarget(gs) {
  const votes = {};
  for (const id of getMafiaPlayers(gs.roles)) {
    const v = gs.mafiaVotes[id];
    if (v) votes[v] = (votes[v] || 0) + 1;
  }
  let max = 0;
  let target = null;
  for (const [id, c] of Object.entries(votes)) if (c > max) {
    max = c;
    target = id;
  }
  const aliveSet = new Set(gs.alive);
  if (!target && !gs.settings.mafiaCanSkipKill) {
    const mafiaIds = getMafiaPlayers(gs.roles);
    const aliveMafia = mafiaIds.filter((id) => aliveSet.has(id));
    if (aliveMafia.length) target = aliveMafia[Math.floor(Math.random() * aliveMafia.length)];
  }
  const doctorSave = gs.doctorSave != null ? gs.doctorSave : null;
  const effectiveKill = target && String(target) !== String(doctorSave) ? target : null;
  return { mafiaTargetId: target, effectiveKillId: effectiveKill, doctorSaveId: doctorSave };
}

/**
 * После ночи мафии/комиссара: считает итог, приват комиссара, очищает ночные поля.
 * Жертва остаётся в alive до «Огласить» (dawn_kill).
 */
export function prepareDawn(gs) {
  const { mafiaTargetId, effectiveKillId, doctorSaveId } = computeMafiaNightTarget(gs);

  gs.commissionerPrivate = null;
  if (gs.commissionerCheck) {
    const targetId = gs.commissionerCheck;
    const mafiaIds = getMafiaPlayers(gs.roles);
    const isMafia = mafiaIds.some((id) => String(id) === String(targetId));
    gs.commissionerPrivate = { targetId, isMafia };
  }

  gs.pendingNight = {
    mafiaTargetId: mafiaTargetId || null,
    effectiveKillId: effectiveKillId || null,
    doctorSaveId: doctorSaveId || null,
    prostituteVisitId: gs.prostituteVisit || null,
    killAnnounced: false,
    doctorAnnounced: false,
    prostituteAnnounced: false,
  };
  gs.publicDawn = {};
  gs.killedTonight = [];
  gs.mafiaVotes = {};
  gs.commissionerCheck = null;
  gs.doctorSave = null;
  gs.prostituteVisit = null;
  gs.nightKill = effectiveKillId || null;
  return gs;
}

/** Применить убийство после оглашения ведущим (dawn_kill). */
export function applyDawnKillAnnounce(gs) {
  const pn = gs.pendingNight;
  if (!pn || pn.killAnnounced) return gs;
  pn.killAnnounced = true;
  const killed = pn.effectiveKillId;
  gs.killedTonight = killed ? [killed] : [];
  if (killed) {
    const aliveSet = new Set(gs.alive);
    aliveSet.delete(killed);
    gs.alive = [...aliveSet];
    if (gs.settings.revealRoleOnDeath) gs.revealed = [...(gs.revealed || []), { id: killed, role: gs.roles[killed] }];
  }
  return gs;
}

export function applyDawnDoctorAnnounce(gs, getPlayerName) {
  const pn = gs.pendingNight;
  if (!pn || pn.doctorAnnounced) return gs;
  pn.doctorAnnounced = true;
  const id = pn.doctorSaveId;
  if (id) {
    gs.publicDawn = { ...(gs.publicDawn || {}), doctor: { id, name: getPlayerName(id) } };
  }
  return gs;
}

export function applyDawnProstituteAnnounce(gs, getPlayerName) {
  const pn = gs.pendingNight;
  if (!pn || pn.prostituteAnnounced) return gs;
  pn.prostituteAnnounced = true;
  const id = pn.prostituteVisitId;
  if (id) {
    gs.publicDawn = { ...(gs.publicDawn || {}), prostituteVisit: { id, name: getPlayerName(id) } };
  }
  return gs;
}

export function nextDawnPhaseAfterKill(gs) {
  const pn = gs.pendingNight;
  const ext = !!gs.settings?.extended;
  if (ext && pn?.doctorSaveId && !pn.doctorAnnounced) return 'dawn_doctor';
  if (ext && pn?.prostituteVisitId && !pn.prostituteAnnounced) return 'dawn_prostitute';
  return 'day';
}

export function nextDawnPhaseAfterDoctor(gs) {
  const pn = gs.pendingNight;
  const ext = !!gs.settings?.extended;
  if (ext && pn?.prostituteVisitId && !pn.prostituteAnnounced) return 'dawn_prostitute';
  return 'day';
}

export function clearDawnPending(gs) {
  gs.pendingNight = null;
  return gs;
}

/** @deprecated — используйте prepareDawn + фазы dawn_*; оставлено для совместимости тестов */
export function resolveNight(gs) {
  const gsCopy = { ...gs, mafiaVotes: { ...gs.mafiaVotes }, commissionerCheck: gs.commissionerCheck, doctorSave: gs.doctorSave };
  const { effectiveKillId } = computeMafiaNightTarget(gs);
  const killed = effectiveKillId;
  gsCopy.nightKill = killed;
  gsCopy.killedTonight = killed ? [killed] : [];
  const aliveSet = new Set(gs.alive);
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
  const entries = Object.entries(votes).filter(([, c]) => c > 0);
  let out = null;
  if (entries.length) {
    const maxC = Math.max(...entries.map(([, c]) => c));
    const topIds = entries
      .filter(([, c]) => c === maxC)
      .map(([id]) => id)
      .sort((a, b) => String(a).localeCompare(String(b)));
    out = topIds[0];
  }
  const gsCopy = {
    ...gs,
    dayVotes: {},
    eliminatedToday: out ? [out] : [],
    /** новая ночь — прошлые «убито ночью» сбрасываются до утренних оглашений */
    killedTonight: [],
  };
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
  /** Пока ведущий не огласил убийство, состав «живых» ещё не финален для победы */
  if (String(gs.phase || '').startsWith('dawn_')) return null;
  const aliveSet = new Set(gs.alive);
  const mafiaIds = getMafiaPlayers(gs.roles);
  const aliveMafia = mafiaIds.filter((id) => aliveSet.has(id));
  const aliveCivilians = gs.alive.filter((id) => !mafiaIds.some((m) => String(m) === String(id)));
  if (aliveMafia.length === 0) return 'civilians';
  if (aliveMafia.length >= aliveCivilians.length) return 'mafia';
  return null;
}

/** Сводка ролей для экрана конца игры */
export function buildMafiaRolesReveal(gs, players) {
  const theme = gs.settings?.theme || 'default';
  const modId = gs.moderatorId;
  return players
    .filter((p) => String(p.id) !== String(modId))
    .map((p) => {
      const role = gs.roles?.[p.id];
      return {
        id: p.id,
        name: p.name,
        role: role || null,
        roleName: role ? getRoleDisplayName(role, theme) : '—',
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
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

  const aliveIdsForVote = gs.alive || [];
  const dvForComplete = gs.dayVotes && typeof gs.dayVotes === 'object' ? gs.dayVotes : {};
  const dayVotingComplete =
    gs.phase === 'voting' &&
    aliveIdsForVote.length > 0 &&
    aliveIdsForVote.every((id) => dvForComplete[id] != null || dvForComplete[String(id)] != null);

  const publicInfo = {
    phase: gs.phase,
    phaseStartedAt: gs.phaseStartedAt || null,
    phaseDurationSec: Number(gs.phaseDurationSec) || null,
    /** Фаза voting: все живые отдали голос — ведущий может «Огласить результат» */
    dayVotingComplete,
    alive: aliveList.map((p) => ({ id: p.id, name: p.name })),
    killedTonight: (gs.killedTonight || []).map((id) => ({ id, name: getPlayerName(id) })),
    eliminatedToday: (gs.eliminatedToday || []).map((id) => ({ id, name: getPlayerName(id) })),
    revealed: (gs.revealed || []).map((r) => ({ id: r.id, role: getRoleDisplayName(r.role, theme) })),
    publicDawn: gs.publicDawn && typeof gs.publicDawn === 'object' ? gs.publicDawn : {},
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
  const moderatorDawn =
    isModerator && gs.pendingNight && String(gs.phase || '').startsWith('dawn_')
      ? {
          step: gs.phase,
          pendingNight: {
            ...gs.pendingNight,
            mafiaTargetName: gs.pendingNight.mafiaTargetId ? getPlayerName(gs.pendingNight.mafiaTargetId) : null,
            effectiveKillName: gs.pendingNight.effectiveKillId ? getPlayerName(gs.pendingNight.effectiveKillId) : null,
            doctorSaveName: gs.pendingNight.doctorSaveId ? getPlayerName(gs.pendingNight.doctorSaveId) : null,
            prostituteVisitName: gs.pendingNight.prostituteVisitId ? getPlayerName(gs.pendingNight.prostituteVisitId) : null,
          },
        }
      : null;
  const commissionerPrivateCheck =
    rawRole === 'commissioner' && gs.commissionerPrivate ? { ...gs.commissionerPrivate } : null;
  /** Ведущий видит факт проверки (для UI ночной фазы), не путать с публичным столом */
  const moderatorCommissionerCheck =
    isModerator && gs.commissionerPrivate ? { ...gs.commissionerPrivate } : null;
  const moderatorRoster =
    isModerator && gs.roles && Object.keys(gs.roles).length > 0
      ? players
          .filter((p) => String(p.id) !== String(gs.moderatorId))
          .map((p) => {
            const r = gs.roles[p.id];
            return {
              id: p.id,
              name: p.name,
              role: r || null,
              roleName: r ? getRoleDisplayName(r, theme) : '—',
            };
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))
      : null;
  const roleExtras = {
    ...(moderatorDawn ? { moderatorDawn } : {}),
    ...(commissionerPrivateCheck ? { commissionerPrivateCheck } : {}),
    ...(moderatorCommissionerCheck ? { moderatorCommissionerCheck } : {}),
    ...(moderatorRoster ? { moderatorRoster } : {}),
  };
  if (mafiaIds.some((id) => String(id) === String(playerId))) {
    const mafiaTeammates = mafiaIds.filter((id) => String(id) !== String(playerId)).map((id) => players.find((p) => String(p.id) === String(id))).filter(Boolean);
    return {
      ...publicInfo,
      myRole: roleForPlayer,
      mafiaTeammates: mafiaTeammates.map((p) => ({ id: p.id, name: p.name })),
      isModerator,
      dayVotes,
      voteCounts,
      ...roleExtras,
    };
  }
  return { ...publicInfo, myRole: roleForPlayer, isModerator, dayVotes, voteCounts, ...roleExtras };
}

export { ROLE_NAMES, THEMES, CLASSIC_ROLES, EXTENDED_ROLES };
