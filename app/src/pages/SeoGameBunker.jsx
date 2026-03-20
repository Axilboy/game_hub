import SeoInfoPage from './SeoInfoPage';

export default function SeoGameBunker({ onBack }) {
  return (
    <SeoInfoPage
      title="Бункер в GameHub — игра на выживание"
      description="Игра «Бункер» в GameHub: роли, обсуждение, голосование и выбор выживших в одной комнате Telegram."
      h1="Игра «Бункер» в Telegram"
      onBack={onBack}
      sections={[
        {
          title: 'Суть игры',
          body: (
            <>
              <div>Каждый игрок получает характеристики персонажа и участвует в обсуждении.</div>
              <div style={{ marginTop: 8 }}>По итогам голосования часть игроков покидает игру.</div>
            </>
          ),
        },
        {
          title: 'Почему удобно онлайн',
          body: (
            <>
              <div>Фазы, таймеры и подсчёт голосов автоматизированы, поэтому партия идёт без пауз.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}
