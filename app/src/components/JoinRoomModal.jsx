import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { resolveJoinPayload } from '../inviteParse';
import { getApiErrorMessage } from '../api';

function QrScannerPanel({ active, onDecoded, onError }) {
  const hostId = useId().replace(/:/g, '');
  const readerId = `join-qr-${hostId}`;
  const onDecodedRef = useRef(onDecoded);
  const onErrorRef = useRef(onError);
  onDecodedRef.current = onDecoded;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const instanceRef = { current: null };

    const run = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const html5QrCode = new Html5Qrcode(readerId, { verbose: false });
        instanceRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (decodedText) onDecodedRef.current(decodedText);
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) onErrorRef.current(e?.message || String(e));
      }
    };
    run();

    return () => {
      cancelled = true;
      const h = instanceRef.current;
      instanceRef.current = null;
      if (h) {
        h.stop().then(() => h.clear()).catch(() => {});
      }
    };
  }, [active, readerId]);

  if (!active) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div
        id={readerId}
        style={{
          width: '100%',
          minHeight: 220,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8, lineHeight: 1.35 }}>
        Наведите камеру на QR с приглашением. Доступ к камере может запросить браузер.
      </p>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(payload: { kind: 'code' | 'invite'; value: string }) => Promise<void>} props.onJoin
 */
export default function JoinRoomModal({ open, onClose, onJoin, title = 'Присоединиться к игре' }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [scan, setScan] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const joinInFlightRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setErr('');
      setBusy(false);
      setScan(false);
      setScanErr('');
    }
  }, [open]);

  const handleDecoded = useCallback(
    async (text) => {
      if (joinInFlightRef.current) return;
      setScanErr('');
      const payload = resolveJoinPayload(text);
      if (!payload) {
        setScanErr('Не удалось разобрать QR. Попробуйте ввести код вручную.');
        return;
      }
      joinInFlightRef.current = true;
      setBusy(true);
      try {
        await onJoin(payload);
      } catch (e) {
        setErr(getApiErrorMessage(e, 'Не удалось войти'));
      } finally {
        setBusy(false);
        joinInFlightRef.current = false;
      }
    },
    [onJoin],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    const payload = resolveJoinPayload(code);
    if (!payload) {
      setErr('Введите код комнаты или вставьте ссылку-приглашение');
      return;
    }
    setBusy(true);
    try {
      await onJoin(payload);
    } catch (ex) {
      setErr(getApiErrorMessage(ex, 'Не удалось войти'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 14, opacity: 0.95 }}>
          Код комнаты
          <input
            type="text"
            className="gh-input gh-input--full"
            style={{ marginTop: 6 }}
            placeholder="Например 123456"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={busy}
          />
        </label>
        {err ? (
          <p role="alert" style={{ color: '#f88', margin: 0, fontSize: 14 }}>
            {err}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </Button>
          <Button type="button" variant="secondary" fullWidth disabled={busy} onClick={() => setScan((s) => !s)}>
            {scan ? 'Скрыть камеру' : 'Отсканировать QR'}
          </Button>
        </div>
      </form>

      <QrScannerPanel
        active={scan && open}
        onDecoded={handleDecoded}
        onError={(msg) => setScanErr(msg)}
      />
      {scanErr ? (
        <p role="status" style={{ color: '#f88', fontSize: 13, marginTop: 8 }}>
          {scanErr}
        </p>
      ) : null}
    </Modal>
  );
}
