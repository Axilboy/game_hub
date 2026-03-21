import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../analytics';
import './homeLandingCarousel.css';
import './landing/gamePromoLanding.css';

const AUTO_INTERVAL_MS = 10000;
const SCROLL_END_DEBOUNCE_MS = 150;

const GAME_SLIDES = [
  {
    key: 'spy',
    to: '/games/spy',
    theme: 'spy',
    emoji: '🕵️',
    eyebrow: 'Шпион',
    title: 'Секретное место и слово',
    subtitle: 'Вопросы, голосование, словари',
  },
  {
    key: 'mafia',
    to: '/games/mafia',
    theme: 'mafia',
    emoji: '🎭',
    eyebrow: 'Мафия',
    title: 'Ночь и день в одной комнате',
    subtitle: 'Роли, фазы, голосование',
  },
  {
    key: 'elias',
    to: '/games/elias',
    theme: 'elias',
    emoji: '🗣️',
    eyebrow: 'Элиас',
    title: 'Объясни слово команде',
    subtitle: 'Словари, таймер, очки',
  },
  {
    key: 'truth_dare',
    to: '/games/truth_dare',
    theme: 'truth_dare',
    emoji: '🎲',
    eyebrow: 'Правда или действие',
    title: 'Карточки на компанию',
    subtitle: 'Категории и safe-режим',
  },
  {
    key: 'bunker',
    to: '/games/bunker',
    theme: 'bunker',
    emoji: '🛡️',
    eyebrow: 'Бункер',
    title: 'Кто войдёт в убежище',
    subtitle: 'Обсуждение и голосования',
  },
];

/** GameHub + 5 игр */
const CYCLE_LEN = 1 + GAME_SLIDES.length;
/** Средняя копия (влево и вправо есть ещё по одной полной серии) */
const MIDDLE_START = CYCLE_LEN;

function scrollSlideIntoViewCenter(root, slideEl, behavior) {
  if (!root || !slideEl) return;
  const left = slideEl.offsetLeft - (root.clientWidth - slideEl.offsetWidth) / 2;
  root.scrollTo({ left: Math.max(0, left), behavior: behavior === 'smooth' ? 'smooth' : 'auto' });
}

function domIndexFromScroll(root) {
  const slides = [...root.querySelectorAll('[data-carousel-slide]')];
  if (!slides.length) return 0;
  const center = root.scrollLeft + root.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  slides.forEach((el, i) => {
    const mid = el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(mid - center);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function logicalIndexFromDom(domIdx) {
  return domIdx % CYCLE_LEN;
}

export default function HomeLandingCarousel() {
  const scrollRef = useRef(null);
  const logicalRef = useRef(0);
  const scrollEndTimerRef = useRef(null);
  const isDraggingRef = useRef(false);

  /** Всегда «приземляемся» на среднюю копию, чтобы влево/вправо был запас */
  const normalizeLoop = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const slides = [...root.querySelectorAll('[data-carousel-slide]')];
    if (slides.length < CYCLE_LEN * 3) return;

    const domIdx = domIndexFromScroll(root);
    logicalRef.current = logicalIndexFromDom(domIdx);

    if (domIdx < CYCLE_LEN) {
      const target = slides[domIdx + MIDDLE_START];
      if (target) scrollSlideIntoViewCenter(root, target, 'auto');
      logicalRef.current = logicalIndexFromDom(domIdx);
      return;
    }

    if (domIdx >= CYCLE_LEN * 2) {
      const target = slides[domIdx - MIDDLE_START];
      if (target) scrollSlideIntoViewCenter(root, target, 'auto');
      logicalRef.current = logicalIndexFromDom(domIdx);
    }
  }, []);

  const onScrollDebounced = useCallback(() => {
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      scrollEndTimerRef.current = null;
      normalizeLoop();
    }, SCROLL_END_DEBOUNCE_MS);
  }, [normalizeLoop]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => onScrollDebounced();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [onScrollDebounced]);

  const goNextAuto = useCallback(() => {
    const root = scrollRef.current;
    if (!root || isDraggingRef.current) return;
    const slides = [...root.querySelectorAll('[data-carousel-slide]')];
    if (slides.length < CYCLE_LEN * 3) return;

    const logical = logicalRef.current;
    const nextLogical = (logical + 1) % CYCLE_LEN;

    /** Все переходы только внутри средней копии (индексы 6…11) */
    if (logical === CYCLE_LEN - 1 && nextLogical === 0) {
      const hubMid = slides[MIDDLE_START];
      if (hubMid) {
        logicalRef.current = 0;
        scrollSlideIntoViewCenter(root, hubMid, 'smooth');
      }
      return;
    }

    const target = slides[MIDDLE_START + nextLogical];
    if (target) {
      scrollSlideIntoViewCenter(root, target, 'smooth');
      logicalRef.current = nextLogical;
    }
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const id = setInterval(goNextAuto, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [goNextAuto]);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    requestAnimationFrame(() => {
      const r = scrollRef.current;
      const slides = r ? [...r.querySelectorAll('[data-carousel-slide]')] : [];
      const hubMid = slides[MIDDLE_START];
      if (r && hubMid) {
        scrollSlideIntoViewCenter(r, hubMid, 'auto');
      }
      logicalRef.current = 0;
    });
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onDown = () => {
      isDraggingRef.current = true;
    };
    const onUp = () => {
      isDraggingRef.current = false;
    };

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('touchend', onUp, { passive: true });

    return () => {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('touchend', onUp);
    };
  }, []);

  const baseSlides = [{ kind: 'hub', key: 'hub' }, ...GAME_SLIDES.map((g) => ({ kind: 'game', ...g }))];
  const renderedSlides = [...baseSlides, ...baseSlides, ...baseSlides];

  return (
    <section className="gh-home-carousel-wrap" aria-label="GameHub и игры">
      <p className="gh-home-carousel__label">Листайте — GameHub или страница игры</p>
      <div className="gh-home-carousel" ref={scrollRef}>
        {renderedSlides.map((s, idx) => {
          if (s.kind === 'hub') {
            return (
              <div
                key={`hub-${idx}`}
                data-carousel-slide
                className="gh-home-carousel__slide gh-home-carousel__slide--hub"
                role="group"
                aria-label="GameHub Party — общий вход"
              >
                <div className="gh-home-carousel__inner gh-home-carousel__inner--hub">
                  <div className="gh-home-carousel__hub-line1">GAMEHUBPARTY - ИГРЫ ДЛЯ КОМПАНИИ ОНЛАЙН</div>
                  <div className="gh-home-carousel__hub-line2">Играй с друзьями прямо в браузере</div>
                  <div className="gh-home-carousel__hub-line3">Без регистрации</div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={`${s.key}-${idx}`}
              to={s.to}
              data-carousel-slide
              className={`gh-home-carousel__slide gpl gpl--${s.theme}`}
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
          );
        })}
      </div>
    </section>
  );
}
