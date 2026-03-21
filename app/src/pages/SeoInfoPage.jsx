import { useLocation } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import PageLayout from '../components/layout/PageLayout';

const baseUrl = (import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
const defaultOgImage = import.meta.env.VITE_OG_IMAGE || (baseUrl ? `${baseUrl}/og-share.svg` : undefined);

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
  ctaLabel,
  onCta,
  keywords,
}) {
  const { pathname } = useLocation();
  const canonical = baseUrl ? `${baseUrl}${pathname}` : undefined;

  useSeo({
    title,
    description,
    canonical,
    robots: 'index, follow',
    ogImage: defaultOgImage,
    ogType: 'website',
    siteName: 'GameHub',
    keywords,
  });

  return (
    <PageLayout title="GameHub" titleHref="/" wideContent>
      <div>
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
    </PageLayout>
  );
}
