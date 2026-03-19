import SeoInfoPage from './SeoInfoPage';

export default function SeoGameElias({ onBack }) {
  return (
    <SeoInfoPage
      title="Элиас в GameHub — игра в Telegram"
      description="«Элиас» — игра в командах, где один объясняет слово, а другие угадывают. Играйте вместе в одной комнате в Telegram."
      h1="Игра «Элиас» в Telegram"
      onBack={onBack}
      sections={[
        {
          title: 'Правила коротко',
          body: (
            <>
              <div>В каждой команде есть ведущий раунда, который видит слово.</div>
              <div style={{ marginTop: 8 }}>Остальные угадывают слово, не произнося его напрямую.</div>
              <div style={{ marginTop: 8 }}>После окончания времени можно переходить к следующему ходу.</div>
            </>
          ),
        },
        {
          title: 'Командные очки',
          body: (
            <>
              <div>Очки начисляются команде, которая угадывает слово.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}

