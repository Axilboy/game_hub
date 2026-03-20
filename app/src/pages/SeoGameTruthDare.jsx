import SeoInfoPage from './SeoInfoPage';

export default function SeoGameTruthDare({ onBack }) {
  return (
    <SeoInfoPage
      title="Правда или действие в GameHub — игра в Telegram"
      description="Игра «Правда или действие» в GameHub: раунды, категории, safe/18+ режимы и быстрые партии для компании."
      h1="Игра «Правда или действие»"
      onBack={onBack}
      sections={[
        {
          title: 'Как проходит раунд',
          body: (
            <>
              <div>Игрок получает карточку из выбранной категории: правда или действие.</div>
              <div style={{ marginTop: 8 }}>После хода очередь автоматически переходит дальше.</div>
            </>
          ),
        },
        {
          title: 'Для каких компаний',
          body: (
            <>
              <div>Есть нейтральные и более смелые категории, включая формат 18+ с подтверждением.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}
