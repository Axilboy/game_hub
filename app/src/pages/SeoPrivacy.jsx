import SeoInfoPage from './SeoInfoPage';

export default function SeoPrivacy({ onBack }) {
  return (
    <SeoInfoPage
      title="Политика конфиденциальности GameHub"
      description="Короткая версия политики: мы используем Telegram user_id и данные, необходимые для работы игр в одной комнате."
      h1="Политика конфиденциальности"
      onBack={onBack}
      sections={[
        {
          title: 'Какие данные используем',
          body: (
            <>
              <div>Идентификатор пользователя Telegram и имя (для отображения в комнате).</div>
              <div style={{ marginTop: 8 }}>Данные пользователя нужны только для работы мини-игр.</div>
            </>
          ),
        },
        {
          title: 'Для чего',
          body: (
            <>
              <div>Чтобы создавать комнаты, распределять роли и синхронизировать состояние игры.</div>
            </>
          ),
        },
      ]}
      showBack
    />
  );
}

