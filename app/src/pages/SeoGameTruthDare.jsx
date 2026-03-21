import SeoInfoPage from './SeoInfoPage';

export default function SeoGameTruthDare({ onBack }) {
  return (
    <SeoInfoPage
      title="Правда или действие в GameHub — игра в Telegram"
      description="Игра «Правда или действие» в GameHub: одна карточка — два задания на выбор, категории, safe/18+ и быстрые партии."
      h1="Игра «Правда или действие»"
      onBack={onBack}
      sections={[
        {
          title: 'Как проходит раунд',
          body: (
            <>
              <div>Игрок получает одну карточку из выбранной темы: на ней и правда, и действие — сам решает, что выполнить.</div>
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
