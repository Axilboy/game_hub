import SeoInfoPage from './SeoInfoPage';

export default function SeoRules() {
  return (
    <SeoInfoPage
      title="Правила GameHub"
      description="Сервис GameHub предназначен для игр в компании. Никаких агрессивных и запрещённых действий — только дружеское время."
      keywords="GameHub, правила сервиса, пользовательское соглашение, игры онлайн"
      h1="Правила GameHub"
      sections={[
        {
          title: 'Коротко',
          body: (
            <>
              <div>Играйте с друзьями и уважайте друг друга.</div>
              <div style={{ marginTop: 8 }}>Не используйте бота для спама и злоупотреблений.</div>
              <div style={{ marginTop: 8 }}>Администрация может ограничить доступ при нарушениях.</div>
            </>
          ),
        },
      ]}
    />
  );
}

