import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import GameplayScreen from '../components/game/GameplayScreen';
import PostMatchScreen from '../components/game/PostMatchScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
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
        title: 'Голосование за состав мафии',
        sub: 'Это не игровое обсуждение — только распределение ролей. Один голос (по желанию можно выбрать двух). По сумме голосов набирается команда мафии. Когда все проголосовали или время вышло — ведущий нажимает «Дальше». Нет голосов — роли случайные.',
        short: 'Состав',
      };
    case 'night_mafia':
      return { title: 'Ночь — мафия', sub: 'С этой ночи мафия может убить одного. Выберите жертву или дождитесь таймера.', short: 'Ночь · мафия' };
    case 'night_commissioner':
      return { title: 'Ночь — комиссар', sub: 'Проверка игрока.', short: 'Ночь · комиссар' };
    case 'night_doctor':
      return { title: 'Ночь — врач', sub: 'Кого лечить этой ночью.', short: 'Ночь · врач' };
    case 'night_prostitute':
      return { title: 'Ночь — путана', sub: 'С кем провести ночь.', short: 'Ночь · путана' };
    case 'dawn_kill':
      return {
        title: 'Утро — оглашение',
        sub: 'Ведущий по очереди оглашает итог ночи. Остальные ждут.',
        short: 'Утро',
      };
    case 'dawn_doctor':
      return {
        title: 'Утро — врач',
        sub: 'Ведущий оглашает действие врача, когда сочтёт нужным.',
        short: 'Утро · врач',
      };
    case 'dawn_prostitute':
      return {
        title: 'Утро — путана',
        sub: 'Ведущий оглашает ночь путаны, когда сочтёт нужным.',
        short: 'Утро · путана',
      };
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
  const { showToast } = useToast();
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
  const [actionLoading, setActionLoading] = useState(null);
  const [setupErr, setSetupErr] = useState(null);
  const [tick, setTick] = useState(0);
  const [rolePeekVisible, setRolePeekVisible] = useState(true);
  const [friendNotes, setFriendNotes] = useState({});
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [endgameRoles, setEndgameRoles] = useState(null);
  const autoAdvanceRef = useRef({ phase: null, phaseStartedAt: null, sent: false });
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!myId || String(myId).startsWith('web_')) return;
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
    const onEnded = (data) => {
      setWinner(data?.winner || null);
      if (Array.isArray(data?.rolesReveal)) setEndgameRoles(data.rolesReveal);
    };
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
      setEndgameRoles(null);
    }
  }, [room?.state, room?.game, room?.lastGameResult]);

  useEffect(() => {
    const rr = room?.lastGameResult?.game === 'mafia' ? room?.lastGameResult?.rolesReveal : null;
    if (Array.isArray(rr)) setEndgameRoles(rr);
  }, [room?.lastGameResult]);

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
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось перейти к следующей фазе') });
      refreshState({ silent: true });
    } finally {
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
      await api.post(`/rooms/${roomId}/mafia/action`, {
        playerId: myId,
        action: 'commissioner_check',
        targetId,
      });
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendDoctorSave = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('doctor_save');
      await api.post(`/rooms/${roomId}/mafia/action`, {
        playerId: myId,
        action: 'doctor_save',
        targetId,
      });
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendProstituteVisit = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('prostitute_visit');
      await api.post(`/rooms/${roomId}/mafia/action`, {
        playerId: myId,
        action: 'prostitute_visit',
        targetId,
      });
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
    if (actionLoading || roleSetupPick.length < 1) return;
    setSetupErr(null);
    try {
      setActionLoading('role_setup');
      const targets = roleSetupPick.length >= 2 ? [roleSetupPick[0], roleSetupPick[1]] : [roleSetupPick[0]];
      await api.post(`/rooms/${roomId}/mafia/role-setup-vote`, {
        playerId: myId,
        targets,
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
      if (prev.length === 1) return [...prev, id];
      return [id];
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
    /** Дневное голосование завершает только ведущий кнопкой «Огласить результат» */
    if (state.phase === 'voting') return;
    /** Утренние оглашения — только вручную */
    if (String(state.phase || '').startsWith('dawn_')) return;
    /** Ночные действия — ведущий переводит фазу вручную после мафии/комиссара/врача/путаны */
    if (['night_mafia', 'night_commissioner', 'night_doctor', 'night_prostitute'].includes(state.phase)) return;
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
  const rolesRevealList = Array.isArray(endgameRoles) ? endgameRoles : lrMafia?.rolesReveal;

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
          {Array.isArray(rolesRevealList) && rolesRevealList.length > 0 && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <p style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Игроки и роли</p>
              <ul className="mafiaRound__rolesReveal">
                {rolesRevealList.map((r) => (
                  <li key={r.id}>
                    <span className="mafiaRound__rolesRevealName">{r.name}</span>
                    <span className="mafiaRound__rolesRevealRole">{r.roleName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PostMatchScreen>
    );
  }

  if (loading) {
    return (
      <>
        <GameplayScreen
          theme="mafia"
          user={user}
          onBack={() => setExitConfirmOpen(true)}
          backTitle="Главная"
          backIcon="⌂"
          showHomeButton={false}
          title="Мафия"
        >
          <Loader label="Загрузка Мафии..." minHeight="50vh" />
        </GameplayScreen>
        <Modal open={exitConfirmOpen} onClose={() => setExitConfirmOpen(false)} title="Выйти из игры?">
          <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.45 }}>
            Вернуться на главный экран?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" fullWidth onClick={() => setExitConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setExitConfirmOpen(false);
                navigate('/');
                onLeave?.();
              }}
            >
              На главную
            </Button>
          </div>
        </Modal>
      </>
    );
  }
  if (!state) {
    return (
      <>
        <GameplayScreen
          theme="mafia"
          user={user}
          onBack={() => setExitConfirmOpen(true)}
          backTitle="Главная"
          backIcon="⌂"
          showHomeButton={false}
          title="Мафия"
        >
          <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} />
        </GameplayScreen>
        <Modal open={exitConfirmOpen} onClose={() => setExitConfirmOpen(false)} title="Выйти из игры?">
          <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.45 }}>
            Вернуться на главный экран?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" fullWidth onClick={() => setExitConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setExitConfirmOpen(false);
                navigate('/');
                onLeave?.();
              }}
            >
              На главную
            </Button>
          </div>
        </Modal>
      </>
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
  const showPhaseTimer =
    String(phase || '').startsWith('dawn_') ? false : !!(state.phaseStartedAt && Number(state.phaseDurationSec) > 0);

  const mafiaNightByModerator = state.settings?.mafiaNightMode === 'moderator';
  const commissionerNightByModerator = state.settings?.commissionerNightMode === 'moderator';
  const doctorNightByModerator = state.settings?.doctorNightMode === 'moderator';
  const prostituteNightByModerator = state.settings?.prostituteNightMode === 'moderator';
  const mafiaTeamIdSet = new Set(
    (state.moderatorRoster || []).filter((r) => r.role === 'mafia' || r.role === 'don').map((r) => String(r.id)),
  );
  const commissionerRosterId = state.moderatorRoster?.find((r) => r.role === 'commissioner')?.id;
  const prostituteRosterId = state.moderatorRoster?.find((r) => r.role === 'prostitute')?.id;

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
    <>
      <GameplayScreen
        theme="mafia"
        user={user}
        onBack={() => setExitConfirmOpen(true)}
        backTitle="Главная"
        backIcon="⌂"
        showHomeButton={false}
        title="Мафия"
      >
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
            {showPhaseTimer && phaseSecondsLeft != null && (
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

          {isModerator && state.rolesReady && Array.isArray(state.moderatorRoster) && state.moderatorRoster.length > 0 && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Состав ролей (только ведущий)</p>
              <ul className="mafiaRound__modRoster">
                {state.moderatorRoster.map((row) => (
                  <li key={row.id}>
                    <span className="mafiaRound__modRosterName">{row.name}</span>
                    <span className="mafiaRound__modRosterRole">{row.roleName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {String(phase || '').startsWith('dawn_') && isModerator && state.moderatorDawn?.pendingNight && (
            <div className="mafiaRound__panel mafiaRound__panel--accent">
              <p className="mafiaRound__panelTitle">Огласить столу</p>
              {state.moderatorDawn.step === 'dawn_kill' && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 12, fontSize: 17, fontWeight: 700 }}>
                  {state.moderatorDawn.pendingNight.effectiveKillName
                    ? `Сегодня мафия убила ${state.moderatorDawn.pendingNight.effectiveKillName}.`
                    : 'Никого не убили этой ночью.'}
                </p>
              )}
              {state.moderatorDawn.step === 'dawn_doctor' && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 12, fontSize: 17, fontWeight: 700 }}>
                  {state.moderatorDawn.pendingNight.doctorSaveName
                    ? `Врач излечил: ${state.moderatorDawn.pendingNight.doctorSaveName}`
                    : 'Врач (огласите по правилам стола).'}
                </p>
              )}
              {state.moderatorDawn.step === 'dawn_prostitute' && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 12, fontSize: 17, fontWeight: 700 }}>
                  {state.moderatorDawn.pendingNight.prostituteVisitName
                    ? `Путана провела ночь с ${state.moderatorDawn.pendingNight.prostituteVisitName}`
                    : 'Путана (огласите по правилам стола).'}
                </p>
              )}
              <p className="mafiaRound__panelHint" style={{ marginBottom: 0 }}>
                Нажмите кнопку внизу — тогда все увидят этот пункт (по очереди, как вы задумали).
              </p>
            </div>
          )}

          {String(phase || '').startsWith('dawn_') && !isModerator && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Утро</p>
              <p className="mafiaRound__panelHint">Ждите объявлений ведущего.</p>
            </div>
          )}

          {(state.publicDawn?.doctor || state.publicDawn?.prostituteVisit) && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Оглашено утром</p>
              {state.publicDawn?.doctor && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 8 }}>
                  Врач лечил: <strong>{state.publicDawn.doctor.name}</strong>
                </p>
              )}
              {state.publicDawn?.prostituteVisit && (
                <p className="mafiaRound__panelHint" style={{ marginBottom: 8 }}>
                  Путана (ночь с): <strong>{state.publicDawn.prostituteVisit.name}</strong>
                </p>
              )}
            </div>
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

          {phase === 'prep_day_1' && !state.rolesReady && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Скоро роли</p>
              <p className="mafiaRound__panelHint">
                Сейчас только подготовка за столом. После этого дня ведущий назначит роли вручную или включится голосование за
                состав — не путайте с игровым обсуждением.
              </p>
            </div>
          )}

          {phase === 'role_setup_vote' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Ваш голос</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 12 }}>
                Выберите одного игрока (обязательно) или двух разных — кого считать в команду мафии. Не себя. Повторное нажатие
                снимает выбор.
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
                  disabled={roleSetupPick.length < 1 || actionLoading === 'role_setup'}
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

          {phase === 'night_mafia' && canKillAtNight && (
            <>
              {mafiaNightByModerator && isModerator && (
                <div className="mafiaRound__panel">
                  <p className="mafiaRound__panelTitle">Жертва ночи (ведущий)</p>
                  <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                    Режим: решение мафии вы задаёте здесь на своём устройстве.
                  </p>
                  <div className="mafiaRound__chips">
                    {alive
                      .filter((p) => !mafiaTeamIdSet.has(String(p.id)))
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
              {mafiaNightByModerator && !isModerator && state.mafiaTeammates !== undefined && (
                <div className="mafiaRound__panel mafiaRound__panel--muted">
                  <p className="mafiaRound__panelTitle">Мафия</p>
                  <p className="mafiaRound__panelHint">В этой партии жертву выбирает ведущий у себя на телефоне. Ожидайте конца фазы.</p>
                </div>
              )}
              {!mafiaNightByModerator && state.mafiaTeammates !== undefined && (
                <div className="mafiaRound__panel">
                  <p className="mafiaRound__panelTitle">Жертва ночи</p>
                  <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                    Режим: голосуют игроки мафии со своих телефонов.
                  </p>
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
            </>
          )}

          {isDead && (
            <div className="mafiaRound__deadNote">Вы выбыли. Наблюдайте за игрой — голосовать и действовать нельзя.</div>
          )}

          {phase === 'night_commissioner' && commissionerNightByModerator && isModerator && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Проверка комиссара (ведущий)</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Кого проверить — задаёте вы. На столе результат не оглашается; комиссар увидит метку на карточке игрока.
              </p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== String(commissionerRosterId))
                  .map((p) => {
                    const chk = state.moderatorCommissionerCheck;
                    const isChecked = chk && String(chk.targetId) === String(p.id);
                    const suspect = isChecked && chk.isMafia;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`mafiaRound__chip${isChecked ? ' mafiaRound__chip--commissionerMark' : ''}${suspect ? ' mafiaRound__chip--commissionerSuspect' : ''}`}
                        onClick={() => sendCommissionerCheck(p.id)}
                        disabled={actionLoading === 'commissioner_check'}
                        title={isChecked ? (suspect ? 'По проверке: мафия (только комиссару)' : 'Не мафия (только комиссару)') : undefined}
                      >
                        {actionLoading === 'commissioner_check' ? (
                          '…'
                        ) : (
                          <>
                            {playerLine(p)}
                            {isChecked ? <span className="mafiaRound__commissionerBadge">🔍</span> : null}
                          </>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
          {phase === 'night_commissioner' && commissionerNightByModerator && !isModerator && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Комиссар</p>
              <p className="mafiaRound__panelHint">В этой партии проверку проводит ведущий у себя на телефоне.</p>
            </div>
          )}
          {phase === 'night_commissioner' && !commissionerNightByModerator && myRole?.role === 'commissioner' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Проверка</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Результат видите только вы: на карточке проверенного игрока — метка. Столу проверка не оглашается.
              </p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => {
                    const chk = state.commissionerPrivateCheck;
                    const isChecked = chk && String(chk.targetId) === String(p.id);
                    const suspect = isChecked && chk.isMafia;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`mafiaRound__chip${isChecked ? ' mafiaRound__chip--commissionerMark' : ''}${suspect ? ' mafiaRound__chip--commissionerSuspect' : ''}`}
                        onClick={() => sendCommissionerCheck(p.id)}
                        disabled={actionLoading === 'commissioner_check'}
                        title={isChecked ? (suspect ? 'По проверке: мафия (только вам)' : 'По проверке: не мафия (только вам)') : undefined}
                      >
                        {actionLoading === 'commissioner_check' ? (
                          '…'
                        ) : (
                          <>
                            {playerLine(p)}
                            {isChecked ? <span className="mafiaRound__commissionerBadge">🔍</span> : null}
                          </>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {phase === 'night_doctor' && doctorNightByModerator && isModerator && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Врач (ведущий)</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Кого лечит врач — выберите вы; в режиме «игроки» это делает врач с телефона.
              </p>
              <div className="mafiaRound__chips">
                {alive.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="mafiaRound__chip"
                    onClick={() => sendDoctorSave(p.id)}
                    disabled={actionLoading === 'doctor_save'}
                  >
                    {actionLoading === 'doctor_save' ? '…' : playerLine(p)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {phase === 'night_doctor' && doctorNightByModerator && !isModerator && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Врач</p>
              <p className="mafiaRound__panelHint">Ведущий отмечает лечение за врача.</p>
            </div>
          )}
          {phase === 'night_doctor' && !doctorNightByModerator && myRole?.role === 'doctor' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Лечение</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Кого защитить этой ночью.
              </p>
              <div className="mafiaRound__chips">
                {alive.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="mafiaRound__chip"
                    onClick={() => sendDoctorSave(p.id)}
                    disabled={actionLoading === 'doctor_save'}
                  >
                    {actionLoading === 'doctor_save' ? '…' : playerLine(p)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'night_prostitute' && prostituteNightByModerator && isModerator && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Путана (ведущий)</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                С кем провести ночь — выберите вы.
              </p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => !prostituteRosterId || String(p.id) !== String(prostituteRosterId))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mafiaRound__chip"
                      onClick={() => sendProstituteVisit(p.id)}
                      disabled={actionLoading === 'prostitute_visit'}
                    >
                      {actionLoading === 'prostitute_visit' ? '…' : playerLine(p)}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {phase === 'night_prostitute' && prostituteNightByModerator && !isModerator && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Путана</p>
              <p className="mafiaRound__panelHint">Ведущий отмечает ночь путаны.</p>
            </div>
          )}
          {phase === 'night_prostitute' && !prostituteNightByModerator && myRole?.role === 'prostitute' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Ночь путаны</p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mafiaRound__chip"
                      onClick={() => sendProstituteVisit(p.id)}
                      disabled={actionLoading === 'prostitute_visit'}
                    >
                      {actionLoading === 'prostitute_visit' ? '…' : playerLine(p)}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {phase === 'voting' && isModerator && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Ведущий</p>
              <p className="mafiaRound__panelHint" style={{ marginBottom: 10 }}>
                Кнопка внизу станет активной «Огласить результат», когда все живые проголосовали или истёк таймер. До этого
                голосование продолжается.
              </p>
              <button
                type="button"
                className="mafiaRound__btn mafiaRound__btn--secondary"
                disabled={!!actionLoading}
                onClick={async () => {
                  if (actionLoading) return;
                  try {
                    setActionLoading('skip_vote');
                    await api.post(`/rooms/${roomId}/mafia/skip-voting`, { playerId: myId });
                    refreshState({ silent: true });
                  } catch (_) {}
                  finally {
                    setActionLoading(null);
                  }
                }}
              >
                {actionLoading === 'skip_vote' ? '…' : 'Пропустить голосование'}
              </button>
            </div>
          )}

          {phase === 'day' && myRole?.role === 'commissioner' && amAlive && state.commissionerPrivateCheck?.targetId && (
            <div className="mafiaRound__panel mafiaRound__panel--muted">
              <p className="mafiaRound__panelTitle">Ваша ночная проверка</p>
              <p className="mafiaRound__panelHint">
                Метка 🔍 у игрока в списке — кого проверяли (только для вас).
              </p>
              <div className="mafiaRound__chips" style={{ marginTop: 10, pointerEvents: 'none', opacity: 0.95 }}>
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => {
                    const chk = state.commissionerPrivateCheck;
                    const isChecked = chk && String(chk.targetId) === String(p.id);
                    const suspect = isChecked && chk.isMafia;
                    return (
                      <div
                        key={p.id}
                        className={`mafiaRound__chip mafiaRound__chip--ghost${isChecked ? ' mafiaRound__chip--commissionerMark' : ''}${suspect ? ' mafiaRound__chip--commissionerSuspect' : ''}`}
                      >
                        <span className="mafiaRound__chipLabel">
                          {playerLine(p)}
                          {isChecked ? <span className="mafiaRound__commissionerBadge">🔍</span> : null}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {phase === 'voting' && amAlive && (
            <div className="mafiaRound__panel">
              <p className="mafiaRound__panelTitle">Исключить игрока</p>
              <div className="mafiaRound__chips">
                {alive
                  .filter((p) => String(p.id) !== myId)
                  .map((p) => {
                    const chk = myRole?.role === 'commissioner' ? state.commissionerPrivateCheck : null;
                    const isChecked = chk && String(chk.targetId) === String(p.id);
                    const suspect = isChecked && chk.isMafia;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`mafiaRound__chip${String(myVoteId) === String(p.id) ? ' mafiaRound__chip--on' : ''}${isChecked ? ' mafiaRound__chip--commissionerMark' : ''}${suspect ? ' mafiaRound__chip--commissionerSuspect' : ''}`}
                        onClick={() => sendVote(p.id)}
                        disabled={!!voteTarget || actionLoading === 'vote'}
                        title={isChecked ? (suspect ? 'Ваша проверка: мафия' : 'Ваша проверка: не мафия') : undefined}
                      >
                        <span className="mafiaRound__chipLabel">
                          {playerLine(p)}
                          {isChecked ? <span className="mafiaRound__commissionerBadge">🔍</span> : null}
                          {String(myVoteId) === String(p.id) ? ' ✓' : ''}
                        </span>
                      </button>
                    );
                  })}
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

          {isModerator && phase !== 'role_setup_moderator' && (() => {
            const votingPhase = phase === 'voting';
            const allVotesIn = state.dayVotingComplete === true;
            const timerOut = phaseSecondsLeft === 0;
            const canAnnounceResult = votingPhase && (allVotesIn || timerOut);
            const isDawn = String(phase || '').startsWith('dawn_');
            const modBtnClass =
              votingPhase && !canAnnounceResult && !isDawn
                ? 'mafiaRound__btn mafiaRound__btn--waiting'
                : 'mafiaRound__btn mafiaRound__btn--accent';
            let modBtnLabel = 'Дальше (ведущий)';
            if (actionLoading === 'advance') modBtnLabel = 'Идёт…';
            else if (isDawn) {
              if (phase === 'dawn_kill') modBtnLabel = 'Огласить';
              else if (phase === 'dawn_doctor') modBtnLabel = 'Огласить (врач)';
              else if (phase === 'dawn_prostitute') modBtnLabel = 'Огласить (путана)';
              else modBtnLabel = 'Огласить';
            } else if (votingPhase) {
              modBtnLabel = canAnnounceResult ? 'Огласить результат' : 'Ждём голосов…';
            } else if (phaseSecondsLeft === 0) modBtnLabel = 'Дальше (таймер вышел)';
            return (
              <button
                type="button"
                className={modBtnClass}
                disabled={!!actionLoading || (votingPhase && !canAnnounceResult && !isDawn)}
                onClick={() =>
                  advancePhase({
                    expectedPhase: phase,
                    expectedPhaseStartedAt: state.phaseStartedAt,
                  })
                }
              >
                {modBtnLabel}
              </button>
            );
          })()}
        </div>
      </GameLayout>
      </GameplayScreen>
      <Modal open={exitConfirmOpen} onClose={() => setExitConfirmOpen(false)} title="Выйти из игры?">
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.45 }}>
          Вернуться на главный экран? Партия для вас на этом устройстве будет прервана.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" fullWidth onClick={() => setExitConfirmOpen(false)}>
            Отмена
          </Button>
          <Button
            fullWidth
            onClick={() => {
              setExitConfirmOpen(false);
              navigate('/');
              onLeave?.();
            }}
          >
            На главную
          </Button>
        </div>
      </Modal>
    </>
  );
}
