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

export function createMafiaState(players, settings = {}) {
  const { extended = false, revealRoleOnDeath = true, mafiaCanSkipKill = false, moderatorId = null, theme = 'default', phaseTimers = null } = settings;
  const pool = players.filter((p) => p.id !== moderatorId);
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
  pool.forEach((p, i) => { roleMap[p.id] = assignment[i] || 'civilian'; });
  const aliveIds = pool.map((p) => p.id);

  return {
    roles: roleMap,
    moderatorId,
    alive: aliveIds,
    phase: 'night_mafia',
    settings: { extended, revealRoleOnDeath, mafiaCanSkipKill, theme, phaseTimers },
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
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function getMafiaPlayers(roles) {
  return Object.entries(roles).filter(([, r]) => r === 'mafia' || r === 'don').map(([id]) => id);
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
  const myRole = gs.roles[playerId] || null;
  const isModerator = gs.moderatorId === playerId;
  const mafiaIds = getMafiaPlayers(gs.roles);
  const theme = gs.settings?.theme || 'default';
  const getPlayerName = (id) => players.find((p) => p.id === id)?.name || id;
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
  };
  let roleForPlayer = null;
  if (myRole) roleForPlayer = { role: myRole, roleName: getRoleDisplayName(myRole, theme) };
  if (mafiaIds.includes(playerId)) {
    const mafiaTeammates = mafiaIds.filter((id) => id !== playerId).map((id) => players.find((p) => p.id === id)).filter(Boolean);
    return { ...publicInfo, myRole: roleForPlayer, mafiaTeammates: mafiaTeammates.map((p) => ({ id: p.id, name: p.name })), isModerator };
  }
  return { ...publicInfo, myRole: roleForPlayer, isModerator };
}

export { ROLE_NAMES, THEMES, CLASSIC_ROLES, EXTENDED_ROLES };
