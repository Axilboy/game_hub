import SeoInfoPage from './SeoInfoPage';

export default function SeoTruthDareStub() {
  return (
    <SeoInfoPage
      title="Правда или действие в GameHub — скоро"
      description="Игра «Правда или действие» скоро появится в GameHub. Следите за обновлениями."
      h1="Правда или действие — скоро"
      sections={[
        {
          title: 'Что будет',
          body: (
            <>
              <div>Раунды с вопросами (правда) и заданиями (действие) для компании.</div>
              <div style={{ marginTop: 8 }}>Никаких действий от вас — просто играйте в общей комнате в Telegram.</div>
            </>
          ),
        },
      ]}
    />
  );
}

