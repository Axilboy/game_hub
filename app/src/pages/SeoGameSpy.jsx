import SeoInfoPage from './SeoInfoPage';

export default function SeoGameSpy({ onBack }) {
  return (
    <SeoInfoPage
      title="Шпион в GameHub — игра в Telegram"
      description="Классическая игра «Шпион»: игроки задают друг другу вопросы, а шпион пытается не выдать себя. Играйте в одной комнате в Telegram."
      h1="Игра «Шпион» в Telegram"
      onBack={onBack}
      sections={[
        {
          title: 'Как играть',
          body: (
            <>
              <div>После старта ведущий раздаёт всем один общий вариант слова, а одному или нескольким игрокам — роль «шпион». </div>
              <div style={{ marginTop: 8 }}>Шпион видит только подсказку «Вы шпион», но не слово.</div>
              <div style={{ marginTop: 8 }}>Остальные задают вопросы и пытаются выяснить, кто шпион.</div>
            </>
          ),
        },
        {
          title: 'Цель',
          body: (
            <>
              <div>Мирные — вычислить шпиона. </div>
              <div style={{ marginTop: 8 }}>Шпион — сохранить инкогнито.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}

