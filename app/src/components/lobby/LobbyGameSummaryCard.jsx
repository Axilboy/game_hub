import { BUNKER_SCENARIOS, BUNKER_SPEED_PRESETS } from '../../lobbyPresets';
import './lobbySettingsSheet.css';

const MIN_PLAYERS = { mafia: 6, elias: 2, truth_dare: 2, bunker: 4 };

function minSpyPlayers(spyCount) {
  const n = Math.min(3, Math.max(1, parseInt(spyCount, 10) || 1));
  return n + 2;
}

/** Короткие имена категорий П/Д для сводки (дубль slug→title из Lobby) */
const TD_CAT_SHORT = {
  classic: 'Классика',
  friends: 'Друзья',
  '18plus': '18+',
  drunk_party: 'Пьяная вечеринка',
  couples: 'Пары',
  company: 'Компания',
  hard: 'Без фильтра',
  romance: 'Романтика',
  corporate: 'Корпоратив SFW',
};

function Row({ icon, label, value, title }) {
  return (
    <div className="lobby-summary-card__row">
      <span className="lobby-summary-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="lobby-summary-card__label">{label}</span>
      <span className="lobby-summary-card__value" title={title || undefined}>
        {value}
      </span>
    </div>
  );
}

/**
 * Компактная сводка настроек выбранной игры — одинаковая для хоста и гостей.
 */
export default function LobbyGameSummaryCard({
  room,
  selectedGame,
  dictNames = {},
  eliasDictNames = {},
}) {
  const gs = room?.gameSettings;
  if (!selectedGame || !gs) return null;

  if (selectedGame === 'spy') {
    const spyIds = Array.isArray(gs.dictionaryIds) ? gs.dictionaryIds : ['free'];
    const dicts = spyIds.length ? spyIds.map((d) => dictNames[d] || d).join(', ') : '— (не выбрано)';
    return (
      <div className="lobby-summary-card">
        <Row icon="🕵️" label="Шпионов" value={String(gs.spyCount ?? 1)} />
        <Row icon="🎲" label="Все шпионы (редко)" value={gs.allSpiesChanceEnabled ? 'да' : 'нет'} />
        <Row icon="👀" label="Шпионы видят друг друга" value={gs.spiesSeeEachOther ? 'да' : 'нет'} />
        <Row icon="📋" label="Список локаций" value={gs.showLocationsList ? 'показан всем' : 'скрыт'} />
        <Row icon="⏱️" label="Таймер" value={gs.timerEnabled ? `${(gs.timerSeconds || 60) / 60} мин` : 'выкл'} />
        <Row icon="📍" label="Локации" value={dicts || '—'} />
        <Row icon="👥" label="Мин. игроков" value={String(minSpyPlayers(gs.spyCount ?? 1))} />
      </div>
    );
  }

  if (selectedGame === 'mafia') {
    const pt = gs.phaseTimers || {};
    const prepDay = pt.prepDay ?? 90;
    const nightMeet = pt.nightMeet ?? 45;
    const roleSetup = pt.roleSetup ?? 120;
    const rolesLine =
      gs.mafiaRolesMode === 'moderator'
        ? 'ведущий назначает'
        : gs.mafiaRolesMode === 'player_vote'
          ? 'голосование'
          : 'случайно';
    const phasesLine = `дни ${prepDay}/${nightMeet}, роли ${roleSetup}, ночь ${pt.nightMafia ?? 45}/${pt.nightCommissioner ?? 25}, день ${pt.day ?? 90}, голос ${pt.voting ?? 45}`;
    return (
      <div className="lobby-summary-card">
        <Row icon="🎭" label="Режим" value={gs.extended ? 'Расширенный' : 'Классика'} />
        <Row icon="🎤" label="Ведущий" value={gs.hostSelection === 'choose' ? 'выбор' : 'случайно'} />
        <Row icon="🗳️" label="Мафия" value={rolesLine} />
        <Row icon="⏱️" label="Фазы (с)" value={phasesLine} />
        <Row
          icon="👥"
          label="Мин. за столом"
          value={String(MIN_PLAYERS.mafia)}
          title="Игроков за столом без ведущего; ведущий ведёт партию отдельно"
        />
      </div>
    );
  }

  if (selectedGame === 'elias') {
    const teams = gs.eliasTeams;
    const teamsLine =
      Array.isArray(teams) && teams.length > 0
        ? teams
            .map(
              (t) =>
                `${t.name}: ${(t.playerIds || []).map((id) => room?.players?.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || '—'}`,
            )
            .join(' · ')
        : null;
    const eliasIds = Array.isArray(gs.dictionaryIds) ? gs.dictionaryIds : ['basic', 'animals', 'memes'];
    const dicts = eliasIds.length ? eliasIds.map((d) => eliasDictNames[d] || d).join(', ') : '— (не выбрано)';
    return (
      <div className="lobby-summary-card">
        <Row icon="⏱️" label="Таймер раунда" value={`${gs.timerSeconds ?? 60} сек`} />
        <Row icon="🏆" label="До очков" value={String(gs.scoreLimit ?? 10)} />
        <Row icon="⏭️" label="Штраф за пропуск" value={`−${gs.skipPenalty ?? 1}`} />
        <Row icon="📚" label="Словари" value={dicts} />
        {teamsLine ? <Row icon="👥" label="Команды" value={teamsLine} /> : null}
        <Row icon="🎯" label="Мин. игроков" value={String(MIN_PLAYERS.elias)} />
      </div>
    );
  }

  if (selectedGame === 'truth_dare') {
    const safe = gs.safeMode !== false;
    const show18 = Boolean(gs.show18Plus);
    const slugs = Array.isArray(gs.categorySlugs) ? gs.categorySlugs : ['classic', 'friends'];
    const cats = slugs.length ? slugs.map((s) => TD_CAT_SHORT[s] || s).join(', ') : '— (не выбрано)';
    const orderMode = gs.truthDareOrderMode === 'random' ? 'random' : 'host';
    const orderLine =
      orderMode === 'random'
        ? 'Случайно каждый ход'
        : (() => {
            const ids = Array.isArray(gs.truthDareTurnOrder) ? gs.truthDareTurnOrder : [];
            const names = ids
              .map((id) => room?.players?.find((p) => String(p.id) === String(id))?.name)
              .filter(Boolean);
            return names.length ? names.join(' → ') : 'По списку лобби (ведущий настроит)';
          })();
    return (
      <div className="lobby-summary-card">
        <Row icon="🎲" label="Формат" value="Правда или действие (без команд)" />
        <Row icon="🛡️" label="Safe" value={safe ? 'да' : 'нет'} />
        <Row icon="🔞" label="18+ категории" value={safe ? 'нет (safe)' : show18 ? 'да' : 'нет'} />
        <Row icon="🔢" label="Очков до победы" value={String(gs.roundsCount ?? 5)} />
        <Row icon="⏭️" label="Пропусков" value={String(gs.skipLimitPerPlayer ?? 2)} />
        <Row icon="📇" label="Категории" value={cats} />
        <Row icon="📋" label="Очередь" value={orderLine} />
        <Row icon="🎯" label="Мин. игроков" value={String(MIN_PLAYERS.truth_dare)} />
      </div>
    );
  }

  if (selectedGame === 'bunker') {
    const speedId = gs.phaseSpeed || 'standard';
    const speedLabel = BUNKER_SPEED_PRESETS.find((p) => p.id === speedId)?.label || speedId;
    const scenId = gs.scenarioId || 'shelter_default';
    const scen = BUNKER_SCENARIOS.find((s) => s.id === scenId);
    const scenLabel = scen?.label || scenId;
    return (
      <div className="lobby-summary-card">
        <Row icon="🔢" label="Раундов" value={String(gs.maxRounds ?? 3)} />
        <Row icon="⚡" label="Скорость фаз" value={speedLabel} />
        <Row icon="🎬" label="Сценарий" value={scen?.premium ? `${scenLabel} 🔒` : scenLabel} />
        <Row icon="👥" label="Мин. игроков" value={String(MIN_PLAYERS.bunker)} />
      </div>
    );
  }

  return null;
}
