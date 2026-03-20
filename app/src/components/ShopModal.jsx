import { useState, useEffect } from 'react';
import { getInventory } from '../inventory';
import { SHOP_GAMES, SHOP_CATEGORIES, SHOP_ITEMS } from '../shopData';
import { PRO_VALUE_MATRIX } from '../proValueMatrix';
import { track } from '../analytics';

const btnStyle = {
  padding: 'var(--gh-space-3, 12px) var(--gh-space-5, 20px)',
  fontSize: 'var(--gh-font-size-md, 16px)',
  borderRadius: 'var(--gh-radius-sm, 8px)',
  border: 'none',
  background: 'var(--gh-color-primary, var(--tg-theme-button-color, #3a7bd5))',
  color: 'var(--gh-color-primary-text, var(--tg-theme-button-text-color, #fff))',
  cursor: 'pointer',
};

export default function ShopModal({ open, onClose, initialGameFilter = 'all' }) {
  const [shopGameFilter, setShopGameFilter] = useState(initialGameFilter);
  const [shopCategoryFilter, setShopCategoryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const inv = getInventory();

  useEffect(() => {
    if (open) {
      setShopGameFilter(initialGameFilter);
      setShopCategoryFilter('all');
      setQuery('');
      track('store_open', { gameFilter: initialGameFilter });
    }
  }, [open, initialGameFilter]);

  if (!open) return null;

  const items = SHOP_ITEMS.filter(
    (item) =>
      (shopGameFilter === 'all' || item.game === shopGameFilter) &&
      (shopCategoryFilter === 'all' || item.category === shopCategoryFilter) &&
      (!query.trim() || `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const popular = items.slice(0, 4);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Магазин и словари</h3>
        <p style={{ fontSize: 13, marginBottom: 12, opacity: 0.9, lineHeight: 1.45 }}>
          Витрина: тематические наборы слов и фичи по играм. С <strong>Про</strong> открываются премиальные словари и режимы для <strong>всех</strong> в вашей комнате.
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по витрине..."
          className="gh-input"
          style={{ marginBottom: 14 }}
        />
        <p style={{ fontSize: 13, marginBottom: 12 }}>Игра</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {SHOP_GAMES.map((g) => (
            <button key={g.id} type="button" onClick={() => setShopGameFilter(g.id)} style={{ ...btnStyle, width: 'auto', padding: '8px 12px', fontSize: 13, background: shopGameFilter === g.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{g.name}</button>
          ))}
        </div>
        <p style={{ fontSize: 13, marginBottom: 12 }}>Категория</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {SHOP_CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setShopCategoryFilter(c.id)} style={{ ...btnStyle, width: 'auto', padding: '8px 12px', fontSize: 13, background: shopCategoryFilter === c.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{c.name}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {popular.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.9 }}>Популярное</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {popular.map((item) => (
                  <div key={`popular-${item.id}`} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{item.emoji} {item.name}</div>
                    <div style={{ marginTop: 4, opacity: 0.85 }}>{item.free ? 'Free' : 'Pro'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {items.map((item) => {
            const locked = !item.free && !inv.hasPro;
            return (
              <div key={item.id} style={{ marginBottom: 12, padding: 14, background: locked ? 'rgba(80,60,60,0.2)' : 'rgba(255,255,255,0.06)', borderRadius: 10, position: 'relative' }}>
                {locked && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>🔒</div>}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}{item.free && <span style={{ fontSize: 12, color: '#8f8', marginLeft: 6 }}>Бесплатно</span>}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>{item.description}</div>
                    {!item.free ? (
                      <button
                        type="button"
                        onClick={() => track('store_item_click', { itemId: item.id, game: item.game, category: item.category })}
                        style={{ ...btnStyle, width: 'auto', marginTop: 8, padding: '6px 10px', fontSize: 12, background: '#555' }}
                      >
                        Хочу это
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.92 }}>Матрица ценности Pro</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRO_VALUE_MATRIX.map((row) => (
                <div key={row.game} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{row.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Free: {row.free.join(', ')}</div>
                  <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>Pro: {row.pro.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, opacity: 0.85, marginTop: 12, lineHeight: 1.45 }}>
          Отдельная покупка карточек пока в разработке. Сейчас самый быстрый путь — <strong>Про</strong>: все премиальные словари, расширенная Мафия и без рекламы перед стартом для всей группы.
        </p>
        <button type="button" onClick={onClose} style={{ ...btnStyle, marginTop: 16 }}>Закрыть</button>
      </div>
    </div>
  );
}
