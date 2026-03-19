import SeoInfoPage from './SeoInfoPage';

export default function SeoGameMafia({ onBack }) {
  return (
    <SeoInfoPage
      title="Мафия в GameHub — игра в Telegram"
      description="Игра «Мафия» в GameHub: ночью роли распределяются ведущим, днём игроки обсуждают и голосуют. Все в одной комнате Telegram."
      h1="Игра «Мафия» в Telegram"
      onBack={onBack}
      sections={[
        {
          title: 'Как проходит игра',
          body: (
            <>
              <div>Ночью игроки выполняют действия по ролям.</div>
              <div style={{ marginTop: 8 }}>Днём команда обсуждает и выбирает, кого изгнать.</div>
            </>
          ),
        },
        {
          title: 'Ключевой принцип',
          body: (
            <>
              <div>Игроки ищут тех, кто действует против команды.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}

