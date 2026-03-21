import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import GameplayScreen from '../components/game/GameplayScreen';
import PostMatchScreen from '../components/game/PostMatchScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';
import './mafiaRound.css';

function phaseUi(phase) {
  switch (phase) {
    case 'prep_day_1':
      return {
        title: 'Первый день',
        sub: 'Подготовка к игре: договоритесь о правилах речи за столом. Игровых действий пока нет.',
        short: 'День 1',
      };
    case 'night_meet':
      return {
        title: 'Первая ночь — знакомство',
        sub: 'Никто не действует по ролям. Мафия узнаёт союзников. Ведущий переводит фазу, когда познакомитесь.',
        short: 'Ночь 1',
      };
    case 'prep_day_2':
      return {
        title: 'Второй день',
        sub: 'Ещё без обсуждений по делу — финальная подготовка. Дальше начнутся ночи с убийством.',
        short: 'День 2',
      };
    case 'role_setup_moderator':
      return { title: 'Ведущий назначает роли', sub: 'Только вы видите этот экран распределения. Игроки ждут, пока вы завершите.', short: 'Подготовка' };
    case 'role_setup_vote':
      return {
        title: 'Кто мафия?',
        sub: 'Два голоса на игрока. По сумме голосов набирается команда мафии (дон + несколько мафий в зависимости от числа игроков). Ведущий завершает фазу, когда готово.',
        short: 'Голосование',
      };
    case 'night_mafia':
      return { title: 'Ночь — мафия', sub: 'С этой ночи мафия может убить одного. Выберите жертву или дождитесь таймера.', short: 'Ночь · мафия' };
    case 'night_commissioner':
      return { title: 'Ночь — комиссар', sub: 'Проверка игрока.', short: 'Ночь · комиссар' };
    case 'day':
      return { title: 'День', sub: 'Обсуждение. Ведущий переводит фазу, когда будете готовы.', short: 'День' };
    case 'voting':
      return { title: 'Голосование', sub: 'Кого исключить из города?', short: 'Голосование' };
    default:
      return { title: 'Мафия', sub: '', short: 'Игра' };
  }
}

export default function MafiaRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  useSeo({
    robots: 'noindex, nofollow',
  });
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);
  const [voteTarget, setVoteTarget] = useState(null);
  const [roleSetupPick, setRoleSetupPick] = useState([]);
  const [modPicks, setModPicks] = useState({
    don: '',
    mafias: [''],
    commissioner: '',
    doctor: '',
    prostitute: '',
  });
  const [commissionerResult, setCommissionerResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [setupErr, setSetupErr] = useState(null);
  const [tick, setTick] = useState(0);
  const [rolePeekVisible, setRolePeekVisible] = useState(true);
  const [friendNotes, setFriendNotes] = useState({});
  const autoAdvanceRef = useRef({ phase: null, phaseStartedAt: null, sent: false });
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!myId) return;
    api
      .get(`/friends/list?playerId=${encodeURIComponent(myId)}`)
      .then((r) => {
        const m = {};
        (r.friends || []).forEach((f) => {
          if (f?.id != null && f.note) m[String(f.id)] = String(f.note);
        });
        setFriendNotes(m);
      })
      .catch(() => {});
  }, [myId, roomId]);

  const refreshState = ({ silent = false } = {}) => {
    if (!myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api
      .get(`/rooms/${roomId}/mafia/state?playerId=${encodeURIComponent(myId)}`)
      .then((s) => {
        if (reqId !== requestSeqRef.current) return;
        setState(s);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        if (reqId !== requestSeqRef.current) return;
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => refreshState(), [roomId, myId]);
  useEffect(() => {
    const onPhase = () => refreshState({ silent: true });
    const onEnded = (data) => setWinner(data?.winner || null);
    const onGameEnded = () => refreshState({ silent: true });
    socket.on('mafia_phase', onPhase);
    socket.on('mafia_ended', onEnded);
    socket.on('game_ended', onGameEnded);
    return () => {
      socket.off('mafia_phase', onPhase);
      socket.off('mafia_ended', onEnded);
      socket.off('game_ended', onGameEnded);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [roomId, myId]);

  useEffect(() => {
    if (room?.state === 'playing' && room?.game === 'mafia' && room?.lastGameResult?.game !== 'mafia') {
      setWinner(null);
    }
  }, [room?.state, room?.game, room?.lastGameResult]);

  useEffect(() => {
    if (state?.phase !== 'voting') setVoteTarget(null);
  }, [state?.phase]);

  useEffect(() => {
    if (state?.phase !== 'role_setup_vote') setRoleSetupPick([]);
    setSetupErr(null);
  }, [state?.phase]);

  const mafiaSlots = state?.roleSetupExpect?.mafiaCount ?? 1;
  useEffect(() => {
    if (!state?.roleSetupExpect) return;
    const n = state.roleSetupExpect.mafiaCount ?? 1;
    setModPicks((p) => {
      const next = [...(p.mafias || [])];
      while (next.length < n) next.push('');
      if (next.length > n) next.length = n;
      return { ...p, mafias: next };
    });
  }, [state?.roleSetupExpect?.mafiaCount]);

  const advancePhase = async (opts = {}) => {
    if (actionLoading) return;
    try {
      setActionLoading('advance');
      const expectedPhase = opts.expectedPhase ?? state?.phase ?? undefined;
      const expectedPhaseStartedAt = opts.expectedPhaseStartedAt ?? state?.phaseStartedAt ?? undefined;
      await api.post(`/rooms/${roomId}/mafia/advance`, {
        playerId: myId,
        expectedPhase,
        expectedPhaseStartedAt,
      });
      refreshState({ silent: true });
      return true;
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
    return false;
  };

  const sendMafiaKill = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('kill');
      await api.post(`/rooms/${roomId}/mafia/action`, {
        playerId: myId,
        action: 'mafia_kill',
        targetId: targetId || undefined,
      });
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendCommissionerCheck = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('commissioner_check');
      const r = await api.post(`/rooms/${roomId}/mafia/action`, {
        playerId: myId,
        action: 'commissioner_check',
        targetId,
      });
      setCommissionerResult(r?.isMafia != null ? (r.isMafia ? 'Мафия' : 'Мирный') : null);
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendVote = async (targetId) => {
    if (actionLoading || !!voteTarget) return;
    try {
      setActionLoading('vote');
      await api.post(`/rooms/${roomId}/mafia/vote`, { playerId: myId, targetId });
      setVoteTarget(targetId);
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendRoleSetupVote = async () => {
    if (actionLoading || roleSetupPick.length !== 2) return;
    setSetupErr(null);
    try {
      setActionLoading('role_setup');
      await api.post(`/rooms/${roomId}/mafia/role-setup-vote`, {
        playerId: myId,
        targets: roleSetupPick,
      });
      refreshState({ silent: true });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Не удалось отправить голос';
      setSetupErr(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const submitModeratorRoles = async () => {
    if (actionLoading) return;
    const ext = !!state?.settings?.extended;
    const { don, mafias, commissioner, doctor, prostitute } = modPicks;
    const needM = mafiaSlots;
    const mafiaIds = (mafias || []).slice(0, needM);
    if (!don || mafiaIds.length !== needM || mafiaIds.some((x) => !x) || !commissioner || (ext && (!doctor || !prostitute))) {
      setSetupErr('Заполните все поля');
      return;
    }
    setSetupErr(null);
    try {
      setActionLoading('set_roles');
      await api.post(`/rooms/${roomId}/mafia/set-roles`, {
        playerId: myId,
        donId: don,
        mafiaIds,
        commissionerId: commissioner,
        doctorId: ext ? doctor : undefined,
        prostituteId: ext ? prostitute : undefined,
      });
      refreshState({ silent: true });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка назначения';
      setSetupErr(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRoleSetup = (id) => {
    if (state?.myRoleSetupTargets) return;
    setRoleSetupPick((prev) => {
      const sid = String(id);
      const i = prev.findIndex((x) => String(x) === sid);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      if (prev.length >= 2) return [prev[0], id];
      return [...prev, id];
    });
  };

  useEffect(() => {
    if (!state?.isModerator) {
      autoAdvanceRef.current = { phase: null, phaseStartedAt: null, sent: false };
      return;
    }
    autoAdvanceRef.current = {
      phase: state.phase,
      phaseStartedAt: state.phaseStartedAt ?? null,
      sent: false,
    };
  }, [state?.isModerator, state?.phase, state?.phaseStartedAt]);

  useEffect(() => {
    if (!state?.isModerator) return;
    if (actionLoading) return;
    if (state.phase === 'role_setup_moderator') return;
    const phaseSecondsLeft =
      state.phaseStartedAt && state.phaseDurationSec
        ? Math.max(0, Math.ceil((state.phaseStartedAt + state.phaseDurationSec * 1000 - Date.now()) / 1000))
        : null;
    if (phaseSecondsLeft == null) return;
    if (phaseSecondsLeft !== 0) return;
    if (!state.phaseStartedAt || !state.phaseDurationSec) return;
    if (autoAdvanceRef.current.sent) return;

    autoAdvanceRef.current.sent = true;
    const ph = state.phase;
    const started = state.phaseStartedAt;
    (async () => {
      const ok = await advancePhase({
        expectedPhase: ph,
        expectedPhaseStartedAt: started,
      });
      if (!ok) autoAdvanceRef.current.sent = false;
    })();
  }, [state, actionLoading, tick]);

  const lrMafia = room?.lastGameResult?.game === 'mafia' ? room.lastGameResult : null;
  const winnerResolved = winner || lrMafia?.winner || null;

  if (winnerResolved) {
    return (
      <PostMatchScreen
        theme="mafia"
        top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
        center={true}
        padding={24}
        primaryLabel="В лобби"
        onPrimary={() => navigate('/lobby')}
        secondaryLabel="Выйти"
        onSecondary={onLeave}
        secondaryBg="#333"
      >
        <div className="gpl__panel" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 22, marginBottom: 16, fontWeight: 800 }}>
            {winnerResolved === 'civilians' ? 'Победили мирные!' : 'Победила мафия!'}
          </p>
        </div>
      </PostMatchScreen>
    );
  }

  if (loading) {
    return (
      <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
        <Loader label="Загрузка Мафии..." minHeight="50vh" />
      </GameplayScreen>
    );
  }
  if (!state) {
    return (
      <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
        <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} />
      </GameplayScreen>
    );
  }

  const isModerator = state.isModerator;
  const myRole = state.myRole;
  const phase = state.phase;
  const alive = state.alive || [];
  const aliveNameById = new Map(alive.map((p) => [String(p.id), p.name]));
  const amAlive = alive.some((p) => String(p.id) === myId);
  const isDead = !amAlive && myRole;
  const myVoteId = state.dayVotes?.[myId] || voteTarget || null;
  const phaseUiInfo = phaseUi(phase);
  const canKillAtNight = state.killNightEnabled !== false && phase === 'night_mafia';
  const playerLine = (p) => (
    <>
      {p.name}
      {String(p.id) === myId ? ' · вы' : ''}
      {friendNotes[String(p.id)] ? (
        <span className="mafiaRound__friendNote"> ({friendNotes[String(p.id)]})</span>
      ) : null}
    </>
  );
  const phaseSecondsLeft =
    state.phaseStartedAt && state.phaseDurationSec
      ? Math.max(0, Math.ceil((state.phaseStartedAt + state.phaseDurationSec * 1000 - Date.now()) / 1000))
      : null;

  const takenModeratorIds = (exclude) => {
    const taken = new Set();
    if (modPicks.don && exclude !== 'don') taken.add(String(modPicks.don));
    if (modPicks.commissioner && exclude !== 'commissioner') taken.add(String(modPicks.commissioner));
    if (modPicks.doctor && exclude !== 'doctor') taken.add(String(modPicks.doctor));
    if (modPicks.prostitute && exclude !== 'prostitute') taken.add(String(modPicks.prostitute));
    (modPicks.mafias || []).forEach((id, idx) => {
      if (id && exclude !== `mafia_${idx}`) taken.add(String(id));
    });
    return taken;
  };

  const optionsForModerator = (excludeKey) => {
    const taken = takenModeratorIds(excludeKey);
    return alive.filter((p) => !taken.has(String(p.id)));
  };

  const renderModeratorSelect = (field, label) => (
    <label key={field} className="mafiaRound__fieldLabel" style={{ display: 'block' }}>
      {label}
      <select
        className="mafiaRound__select"
        value={modPicks[field]}
        onChange={(e) => setModPicks((m) => ({ ...m, [field]: e.target.value }))}
      >
        <option value="">— выберите —</option>
        {optionsForModerator(field).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {friendNotes[String(p.id)] ? ` — ${friendNotes[String(p.id)]}` : ''}
          </option>
        ))}
      </select>
    </label>
  );

  const renderModeratorMafiaSelect = (index) => (
    <label key={`mafia-${index}`} className="mafiaRound__fieldLabel" style={{ display: 'block' }}>
      Мафия {mafiaSlots > 1 ? `(${index + 1}/${mafiaSlots})` : ''}
      <select
        className="mafiaRound__select"
        value={modPicks.mafias[index] || ''}
        onChange={(e) =>
          setModPicks((m) => {
            const next = [...(m.mafias || [])];
            next[index] = e.target.value;
            return { ...m, mafias: next };
          })
        }
      >
        <option value="">— выберите —</option>
        {optionsForModerator(`mafia_${index}`).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {friendNotes[String(p.id)] ? ` — ${friendNotes[String(p.id)]}` : ''}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
      <GameLayout top={null} center={false} padding={0} minHeight="auto" textAlign="center" bottom={null}>
        <div className="mafiaRound">
          {myRole && (
            <button
              type="button"
              className="gameplay__peek-block"
              onClick={() => setRolePeekVisible((v) => !v)}
              aria-label={rolePeekVisible ? 'Скрыть роль' : 'Показать роль'}
            >
              <span className="gameplay__peek-block__label">Ваша роль</span>
              {rolePeekVisible ? (
                <span className="gameplay__peek-block__word" style={{ color: 'var(--gpl-accent)' }}>
                  {myRole.roleName}
                </span>
              ) : (
                <span className="gameplay__peek-block__hidden">Роль скрыта — нажмите, чтобы показать</span>
              )}
            </button>
          )}

          <div className="mafiaRound__hero">
            <p className="mafiaRound__phaseLabel">{phaseUiInfo.short}</p>
            <h2 className="mafiaRound__title">{phaseUiInfo.title}</h2>
            <p className="mafiaRound__sub">{phaseUiInfo.sub}</p>
            {phaseSecondsLeft != null && (
              <div className={`mafiaRound__timer${phaseSecondsLeft <= 10 ? ' mafiaRound__timer--warn' : ''}`}>
                ⏱ {phaseSecondsLeft} сек
              </div>
            )}
          </div>

          {isModerator && (
            <p className="mafiaRound__modNote">
              Вы ведущий
              {phase === 'role_setup_vote' && state.roleSetupVotedCount != null && (
                <span className="mafiaRound__badge">
                  голоса {state.roleSetupVotedCount}/{state.roleSetupTotal ?? alive.length}
                </span>
              )}
            </p>
          )}

          {(state.killedTonight?.length > 0 || state.eliminatedToday?.length > 0 || state.revealed?.length > 0) && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">События</p>
              {state.killedTonight?.length > 0 && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 8 }}>
                  Погибли ночью:{' '}
                  {state.killedTonight.map((x) => (typeof x === 'object' && x?.name ? x.name : x)).join(', ')}
                </p>
              )}
              {state.eliminatedToday?.length > 0 && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 8 }}>
                  Исключены днём:{' '}
                  {state.eliminatedToday.map((x) => (typeof x === 'object' && x?.name ? x.name : x)).join(', ')}
                </p>
              )}
              {state.revealed?.length > 0 &&
                state.revealed.map((r) => (
                  <p key={r.id} className="mafiaRound__panelHint" style={{ margin: '4px 0' }}>
                    Раскрыта роль: <strong>{r.role}</strong>
                  </p>
                ))}
            </div>
          )}

          {phase === 'role_setup_moderator' && isModerator && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Назначьте роли</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 14 }}>
                Ведущий в игру не входит. Состав: дон ×1, мафия ×{mafiaSlots}, комиссар ×1
                {state.settings?.extended ? ', доктор ×1, путана ×1' : ''}, остальные — мирные.
                {state.roleSetupExpect && (
                  <>
                    {' '}
                    Сейчас за столом <strong>{state.roleSetupExpect.playersInGame}</strong> игроков, мирных будет{' '}
                    <strong>{state.roleSetupExpect.civilianCount}</strong>.
                  </>
                )}
              </p>
              {setupErr && <p className="mafiaRound__err">{setupErr}</p>}
              {renderModeratorSelect('don', 'Дон')}
              {Array.from({ length: mafiaSlots }, (_, i) => renderModeratorMafiaSelect(i))}
              {renderModeratorSelect('commissioner', 'Комиссар')}
              {state.settings?.extended && (
                <>
                  {renderModeratorSelect('doctor', 'Доктор')}
                  {renderModeratorSelect('prostitute', 'Путана')}
                </>
              )}
              <button
                type="button"
                className="mafiaRound__btn mafiaRound__btn--accent"
                disabled={!!actionLoading}
                onClick={submitModeratorRoles}
              >
                {actionLoading === 'set_roles' ? 'Сохраняем…' : 'Начать ночь'}
              </button>
            </div>
          )}

          {phase === 'role_setup_moderator' && !isModerator && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Ожидайте ведущего</p>
              <p className="mafiaRound__panelHint">Ведущий распределяет роли на своём телефоне. Скоро вы увидите свою карту.</p>
            </div>
          )}

          {phase === 'role_setup_vote' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Ваш голос</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 12 }}>
                Выберите двух разных игроков (не себя). Можно снять выбор, нажав ещё раз.
              </p>
              {setupErr && <p className="mafiaRound__err">{setupErr}</p>}
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => {
                    const on = roleSetupPick.some((x) => String(x) === String(p.id));
                    const locked = !!state.myRoleSetupTargets;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`mafiaRound__chip${on ? ' mafiaRound__chip--on' : ''}`}
                        disabled={locked || actionLoading === 'role_setup'}
                        onClick={() => toggleRoleSetup(p.id)}
                      >
                        <span className="mafiaRound__chipLabel">
                          {playerLine(p)}
                          {on ? ' ✓' : ''}
                        </span>
                      </button>
                    );
                  })}
              </div>
              {state.myRoleSetupTargets && (
                <p className="mafiaRound__panelHint" style={{ marginTop: 12 }}>
                  Голос отправлен:{' '}
                  {state.myRoleSetupTargets.map((id) => aliveNameById.get(String(id)) || id).join(' и ')}
                </p>
              )}
              {!state.myRoleSetupTargets && (
                <button
                  type="button"
                  className="mafiaRound__btn mafiaRound__btn--accent"
                  disabled={roleSetupPick.length !== 2 || actionLoading === 'role_setup'}
                  onClick={sendRoleSetupVote}
                >
                  {actionLoading === 'role_setup' ? 'Отправка…' : 'Отправить голос'}
                </button>
              )}
            </div>
          )}

          {phase === 'role_setup_vote' && !amAlive && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelHint">Вы не в списке голосующих (ведущий вне игры).</p>
            </div>
          )}

          <div className="mafiaRound__panel mafiaRound__panel--muted">
            <p className="mafiaRound__panelTitle">Подсказка</p>
            <p className="mafiaRound__panelHint">
              Первые два дня и первая ночь — без убийств. Со второй ночи мафия убивает одного за ночь, днём город может
              исключить одного игрока голосованием.
            </p>
          </div>

          {phase === 'night_meet' && state.mafiaTeammates !== undefined && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Ваша команда мафии</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Убийства пока нет — только знакомство. Запомните союзников.
              </p>
              {(state.mafiaTeammates || []).length ? (
                (state.mafiaTeammates || []).map((m) => (
                  <div key={m.id} className="mafiaRound__voteTally" style={{ marginBottom: 6 }}>
                    {playerLine({ id: m.id, name: m.name })}
                  </div>
                ))
              ) : (
                <p className="mafiaRound__panelHint">Вы единственный представитель мафии в этой партии.</p>
              )}
            </div>
          )}

          {phase === 'night_meet' && state.mafiaTeammates === undefined && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelHint">Мафия знакомится с командой. Остальные игроки «спят».</p>
            </div>
          )}

          {phase === 'night_mafia' && state.mafiaTeammates !== undefined && canKillAtNight && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Жертва ночи</p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => !state.mafiaTeammates?.some((m) => String(m.id) === String(p.id)))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mafiaRound__chip mafiaRound__chip--danger"
                      onClick={() => sendMafiaKill(p.id)}
                      disabled={actionLoading === 'kill'}
                    >
                      {actionLoading === 'kill' ? (
                        <>…</>
                      ) : (
                        playerLine(p)
                      )}
                    </button>
                  ))}
              </div>
              {state.settings?.mafiaCanSkipKill && (
                <button
                  type="button"
                  className="mafiaRound__chip mafiaRound__chip--ghost"
                  onClick={() => sendMafiaKill(null)}
                  disabled={actionLoading === 'kill'}
                >
                  Не убивать эту ночь
                </button>
              )}
            </div>
          )}

          {isDead && (
            <div className="mafiaRound__deadNote">Вы выбыли. Наблюдайте за игрой — голосовать и действовать нельзя.</div>
          )}

          {phase === 'night_commissioner' && myRole?.role === 'commissioner' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Проверка</p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mafiaRound__chip"
                      onClick={() => sendCommissionerCheck(p.id)}
                      disabled={actionLoading === 'commissioner_check'}
                    >
                      {actionLoading === 'commissioner_check' ? '…' : playerLine(p)}
                    </button>
                  ))}
              </div>
              {commissionerResult != null && (
                <p className="mafiaRound__voteTally" style={{ marginTop: 12, fontWeight: 700, color: 'var(--gpl-accent)' }}>
                  Результат: {commissionerResult}
                </p>
              )}
            </div>
          )}

          {phase === 'voting' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Исключить игрока</p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`mafiaRound__chip${String(myVoteId) === String(p.id) ? ' mafiaRound__chip--on' : ''}`}
                      onClick={() => sendVote(p.id)}
                      disabled={!!voteTarget || actionLoading === 'vote'}
                    >
                      <span className="mafiaRound__chipLabel">
                        {playerLine(p)}
                        {String(myVoteId) === String(p.id) ? ' ✓' : ''}
                      </span>
                    </button>
                  ))}
              </div>
              {myVoteId && (
                <p className="mafiaRound__panelHint" style={{ marginTop: 12 }}>
                  Ваш голос: <strong>{aliveNameById.get(String(myVoteId)) || 'принят'}</strong>
                </p>
              )}
            </div>
          )}

          {phase === 'voting' && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Счёт голосов</p>
              {alive.length === 0 ? (
                <p className="mafiaRound__panelHint">Нет живых игроков.</p>
              ) : (
                alive.map((p) => (
                  <div key={p.id} className="mafiaRound__voteTally">
                    <span className="mafiaRound__chipLabel">{playerLine(p)}</span>:{' '}
                    <strong>{state.voteCounts?.[p.id] ?? state.voteCounts?.[String(p.id)] ?? 0}</strong>
                  </div>
                ))
              )}
            </div>
          )}

          {isModerator && phase !== 'role_setup_moderator' && (
            <button
              type="button"
              className="mafiaRound__btn mafiaRound__btn--secondary"
              disabled={!!actionLoading}
              onClick={advancePhase}
            >
              {actionLoading === 'advance'
                ? 'Идёт…'
                : phaseSecondsLeft === 0
                  ? 'Дальше (таймер вышел)'
                  : 'Дальше (ведущий)'}
            </button>
          )}
        </div>
      </GameLayout>
    </GameplayScreen>
  );
}
