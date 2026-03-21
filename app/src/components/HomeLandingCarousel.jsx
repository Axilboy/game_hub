import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../analytics';
import './homeLandingCarousel.css';
import './landing/gamePromoLanding.css';

const GAP_PX = 12;
const AUTO_INTERVAL_MS = 4800;

const SLIDES = [
  {
    to: '/games/spy',
    theme: 'spy',
    emoji: '🕵️',
    eyebrow: 'Шпион',
    title: 'Секретное место и слово',
    subtitle: 'Вопросы, голосование, словари',
  },
  {
    to: '/games/mafia',
    theme: 'mafia',
    emoji: '🎭',
    eyebrow: 'Мафия',
    title: 'Ночь и день в одной комнате',
    subtitle: 'Роли, фазы, голосование',
  },
  {
    to: '/games/elias',
    theme: 'elias',
    emoji: '🗣️',
    eyebrow: 'Элиас',
    title: 'Объясни слово команде',
    subtitle: 'Словари, таймер, очки',
  },
  {
    to: '/games/truth_dare',
    theme: 'truth_dare',
    emoji: '🎲',
    eyebrow: 'Правда или действие',
    title: 'Карточки на компанию',
    subtitle: 'Категории и safe-режим',
  },
  {
    to: '/games/bunker',
    theme: 'bunker',
    emoji: '🛡️',
    eyebrow: 'Бункер',
    title: 'Кто войдёт в убежище',
    subtitle: 'Обсуждение и голосования',
  },
];

function syncIndexFromScroll(root, indexRef) {
  const slides = Array.from(root.querySelectorAll('[data-landing-slide]'));
  if (!slides.length) return;
  const first = slides[0];
  const step = first.offsetWidth + GAP_PX;
  if (step <= 0) return;
  const i = Math.round(root.scrollLeft / step);
  indexRef.current = Math.max(0, Math.min(slides.length - 1, i));
}

export default function HomeLandingCarousel() {
  const scrollRef = useRef(null);
  const indexRef = useRef(0);

  const sync = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    syncIndexFromScroll(root, indexRef);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        sync();
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [sync]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    sync();

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const slides = () => Array.from(root.querySelectorAll('[data-landing-slide]'));
    const id = setInterval(() => {
      const list = slides();
      if (list.length < 2) return;
      const n = list.length;
      const next = (indexRef.current + 1) % n;
      list[next]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      indexRef.current = next;
    }, AUTO_INTERVAL_MS);

    return () => clearInterval(id);
  }, [sync]);

  return (
    <section className="gh-home-carousel-wrap" aria-label="Промо-страницы игр">
      <p className="gh-home-carousel__label">Игры — подробности и старт с выбранной игрой</p>
      <div className="gh-home-carousel" ref={scrollRef} role="list">
        {SLIDES.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            data-landing-slide
            className={`gh-home-carousel__slide gpl gpl--${s.theme}`}
            role="listitem"
            onClick={() => track('home_carousel_landing', { path: s.to, theme: s.theme })}
          >
            <div className="gh-home-carousel__inner">
              <div className="gh-home-carousel__emoji" aria-hidden>
                {s.emoji}
              </div>
              <p className="gh-home-carousel__eyebrow">{s.eyebrow}</p>
              <h3 className="gh-home-carousel__title">{s.title}</h3>
              <p className="gh-home-carousel__subtitle">{s.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
