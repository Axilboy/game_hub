import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
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
  /** Пользователь тянул/свайпнул ленту — после остановки скролла перезапускаем таймер автолистания */
  const userDraggedCarouselRef = useRef(false);
  const autoIntervalRef = useRef(null);
  const goNextAutoRef = useRef(null);
  const [activeLogical, setActiveLogical] = useState(0);

  const scheduleAutoAdvance = useCallback(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    if (typeof window === 'undefined') return;
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    } catch (_) {
      return;
    }
    autoIntervalRef.current = setInterval(() => {
      goNextAutoRef.current?.();
    }, AUTO_INTERVAL_MS);
  }, []);

  const syncActiveFromRef = useCallback(() => {
    setActiveLogical(logicalRef.current);
  }, []);

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
      syncActiveFromRef();
      return;
    }

    if (domIdx >= CYCLE_LEN * 2) {
      const target = slides[domIdx - MIDDLE_START];
      if (target) scrollSlideIntoViewCenter(root, target, 'auto');
      logicalRef.current = logicalIndexFromDom(domIdx);
    }
    syncActiveFromRef();
  }, [syncActiveFromRef]);

  const onScrollDebounced = useCallback(() => {
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      scrollEndTimerRef.current = null;
      normalizeLoop();
      if (userDraggedCarouselRef.current) {
        scheduleAutoAdvance();
        userDraggedCarouselRef.current = false;
      }
    }, SCROLL_END_DEBOUNCE_MS);
  }, [normalizeLoop, scheduleAutoAdvance]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => onScrollDebounced();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [onScrollDebounced]);

  const scrollToLogical = useCallback(
    (logical, behavior) => {
      const root = scrollRef.current;
      if (!root) return;
      const slides = [...root.querySelectorAll('[data-carousel-slide]')];
      const target = slides[MIDDLE_START + logical];
      if (!target) return;
      logicalRef.current = logical;
      setActiveLogical(logical);
      scrollSlideIntoViewCenter(root, target, behavior);
      scheduleAutoAdvance();
    },
    [scheduleAutoAdvance],
  );

  const goNextAuto = useCallback(() => {
    const root = scrollRef.current;
    if (!root || isDraggingRef.current) return;
    const slides = [...root.querySelectorAll('[data-carousel-slide]')];
    if (slides.length < CYCLE_LEN * 3) return;

    const logical = logicalRef.current;
    const nextLogical = (logical + 1) % CYCLE_LEN;

    if (logical === CYCLE_LEN - 1 && nextLogical === 0) {
      const hubMid = slides[MIDDLE_START];
      if (hubMid) {
        logicalRef.current = 0;
        setActiveLogical(0);
        scrollSlideIntoViewCenter(root, hubMid, 'smooth');
      }
      return;
    }

    const target = slides[MIDDLE_START + nextLogical];
    if (target) {
      scrollSlideIntoViewCenter(root, target, 'smooth');
      logicalRef.current = nextLogical;
      setActiveLogical(nextLogical);
    }
  }, []);

  useEffect(() => {
    goNextAutoRef.current = goNextAuto;
  }, [goNextAuto]);

  useEffect(() => {
    scheduleAutoAdvance();
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [scheduleAutoAdvance]);

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
      setActiveLogical(0);
    });
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onDown = () => {
      isDraggingRef.current = true;
      userDraggedCarouselRef.current = true;
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

  const handlePrev = () => {
    const prev = (logicalRef.current - 1 + CYCLE_LEN) % CYCLE_LEN;
    track('home_carousel_nav', { action: 'prev', logical: prev });
    scrollToLogical(prev, 'smooth');
  };

  const handleNext = () => {
    const next = (logicalRef.current + 1) % CYCLE_LEN;
    track('home_carousel_nav', { action: 'next', logical: next });
    scrollToLogical(next, 'smooth');
  };

  const handleDot = (i) => {
    track('home_carousel_nav', { action: 'dot', logical: i });
    scrollToLogical(i, 'smooth');
  };

  const baseSlides = [{ kind: 'hub', key: 'hub' }, ...GAME_SLIDES.map((g) => ({ kind: 'game', ...g }))];
  const renderedSlides = [...baseSlides, ...baseSlides, ...baseSlides];

  const dotLabels = ['GameHub', 'Шпион', 'Мафия', 'Элиас', 'Правда или действие', 'Бункер'];

  return (
    <section className="gh-home-carousel-wrap" aria-label="GameHub и игры">
      <div className="gh-home-carousel__frame">
        <div className="gh-home-carousel__strip">
          <button
            type="button"
            className="gh-home-carousel__arrow gh-home-carousel__arrow--prev"
            aria-label="Предыдущий слайд"
            onClick={handlePrev}
          >
            ‹
          </button>
          <button
            type="button"
            className="gh-home-carousel__arrow gh-home-carousel__arrow--next"
            aria-label="Следующий слайд"
            onClick={handleNext}
          >
            ›
          </button>
          <div className="gh-home-carousel" ref={scrollRef} role="region" aria-roledescription="карусель">
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
        </div>
        <div className="gh-home-carousel__dots" role="tablist" aria-label="Выбор слайда">
          {Array.from({ length: CYCLE_LEN }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={activeLogical === i}
              aria-label={`${dotLabels[i] || `Слайд ${i + 1}`}, ${i + 1} из ${CYCLE_LEN}`}
              className={`gh-home-carousel__dot${activeLogical === i ? ' gh-home-carousel__dot--active' : ''}`}
              onClick={() => handleDot(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
