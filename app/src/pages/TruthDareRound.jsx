import { useNavigate } from 'react-router-dom';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: '100%',
};

export default function TruthDareRound({ onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });

  return (
    <div style={{ padding: 24, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <BackArrow onClick={() => navigate('/lobby')} title="В лобби" />
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Правда или действие</h2>
      <p style={{ opacity: 0.9, marginBottom: 24 }}>Скоро будет добавлена полная версия игры.</p>
      <button type="button" onClick={() => navigate('/lobby')} style={{ ...btnStyle, background: '#333', flex: 0 }}>
        В лобби
      </button>
      {onLeave && (
        <button type="button" onClick={onLeave} style={{ ...btnStyle, background: '#555', marginTop: 8 }}>
          Выйти
        </button>
      )}
    </div>
  );
}

