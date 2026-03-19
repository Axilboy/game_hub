import useSeo from '../hooks/useSeo';
import BackArrow from '../components/BackArrow';

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
};

export default function SeoInfoPage({
  title,
  description,
  h1,
  sections = [],
  showBack = true,
  onBack,
  ctaLabel,
  onCta,
}) {
  useSeo({ title, description });

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {showBack && onBack ? <BackArrow onClick={onBack} title="Назад" /> : null}
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>{h1}</h1>
      <p style={{ opacity: 0.9, lineHeight: 1.5, marginBottom: 18 }}>
        {description}
      </p>

      {sections.map((s, idx) => (
        <section key={idx} style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 8 }}>{s.title}</h3>
          <div style={{ lineHeight: 1.6, opacity: 0.92 }}>
            {s.body}
          </div>
        </section>
      ))}

      {ctaLabel && onCta ? (
        <button type="button" onClick={onCta} style={btnStyle}>
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

