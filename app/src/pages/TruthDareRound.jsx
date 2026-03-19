import { useNavigate } from 'react-router-dom';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import Button from '../components/ui/Button';

export default function TruthDareRound({ onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });

  return (
    <GameLayout
      top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
      bottom={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <Button variant="ghost" fullWidth={false} style={{ background: '#333' }} onClick={() => navigate('/lobby')}>
            В лобби
          </Button>
          {onLeave ? (
            <Button variant="ghost" fullWidth={false} style={{ background: '#555' }} onClick={onLeave}>
              Выйти
            </Button>
          ) : null}
        </div>
      }
    >
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Правда или действие</h2>
      <p style={{ opacity: 0.9, marginBottom: 24 }}>Скоро будет добавлена полная версия игры.</p>
    </GameLayout>
  );
}

