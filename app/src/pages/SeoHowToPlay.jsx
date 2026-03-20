import SeoInfoPage from './SeoInfoPage';

export default function SeoHowToPlay({ onBack }) {
  return (
    <SeoInfoPage
      title="Как играть в GameHub"
      description="Короткая инструкция: создайте комнату в GameHub, разошлите приглашение, выберите игру и начинайте."
      h1="Как играть в GameHub"
      onBack={onBack}
      sections={[
        {
          title: 'Шаг 1 — начните игру',
          body: (
            <>
              <div>Откройте GameHub в Telegram или в браузере.</div>
              <div style={{ marginTop: 8 }}>Нажмите «Начать игру», чтобы создать комнату и получить код или приглашение.</div>
            </>
          ),
        },
        {
          title: 'Шаг 2 — пригласите игроков',
          body: (
            <>
              <div>Отправьте приглашение друзьям (внутри Telegram).</div>
              <div style={{ marginTop: 8 }}>Все игроки заходят в одну и ту же комнату.</div>
            </>
          ),
        },
        {
          title: 'Шаг 3 — выберите игру и начните',
          body: (
            <>
              <div>Хост выбирает игру и настройки (если они доступны).</div>
              <div style={{ marginTop: 8 }}>После этого начинается раунд.</div>
              <div style={{ marginTop: 8 }}>
                Попробуйте режимы:
                {' '}
                <a href="/games/spy">Шпион</a>,
                {' '}
                <a href="/games/mafia">Мафия</a>,
                {' '}
                <a href="/games/elias">Элиас</a>,
                {' '}
                <a href="/games/truth_dare">Правда/Действие</a>,
                {' '}
                <a href="/games/bunker">Бункер</a>.
              </div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}

