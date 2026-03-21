/**
 * Расклад игроков по командам (как в app/src/lobbyTeamUtils для 2 команд + round-robin для 3+).
 * playerIds — порядок как в room.players.
 */
export function assignPlayerIdsToTeams(playerIds, teamCount) {
  if (!Array.isArray(playerIds) || teamCount < 2) return null;
  const ids = [...playerIds];
  const n = ids.length;
  if (n === 0) return null;
  const out = Array.from({ length: teamCount }, () => []);
  if (teamCount === 2) {
    if (n === 1) {
      out[0].push(ids[0]);
      return out;
    }
    if (n === 2) {
      out[0].push(ids[0]);
      out[1].push(ids[1]);
      return out;
    }
    if (n === 3) {
      out[0].push(ids[0], ids[1]);
      out[1].push(ids[2]);
      return out;
    }
    ids.forEach((id, i) => (i % 2 === 0 ? out[0] : out[1]).push(id));
    return out;
  }
  ids.forEach((id, i) => out[i % teamCount].push(id));
  return out;
}
