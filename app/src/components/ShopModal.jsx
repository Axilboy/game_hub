import { useState, useEffect, useRef, useCallback } from 'react';
import { addPurchaseHistory, getInventory, purchaseDictionary, restorePurchases, setPro, unlockItem } from '../inventory';
import { SHOP_GAMES, SHOP_CATEGORIES, SHOP_ITEMS } from '../shopData';
import { PRO_VALUE_MATRIX } from '../proValueMatrix';
import { getShopItemMarketing } from '../shopItemMarketing';
import { track } from '../analytics';
import { isBrowserGuestUser } from '../account';
import { useAuth } from '../authContext';
import Select from './ui/Select';
import Tooltip from './ui/Tooltip';
import './shopModal.css';

export default function ShopModal({ open, onClose, initialGameFilter = 'all', user: userProp = null }) {
  const { user: authUser, openAuthModal } = useAuth();
  const user = userProp ?? authUser;
  const [shopGameFilter, setShopGameFilter] = useState(initialGameFilter);
  const [shopCategoryFilter, setShopCategoryFilter] = useState('all');
  const [inv, setInv] = useState(getInventory);
  const [detailItem, setDetailItem] = useState(null);
  const listScrollRef = useRef(null);

  useEffect(() => {
    if (open) {
      setShopGameFilter(initialGameFilter);
      setShopCategoryFilter('all');
      setInv(getInventory());
      setDetailItem(null);
      track('store_open', { gameFilter: initialGameFilter });
    }
  }, [open, initialGameFilter]);

  /** После смены фильтра — список с начала, чтобы были видны товары */
  useEffect(() => {
    if (!open) return;
    const el = listScrollRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [open, shopGameFilter, shopCategoryFilter]);

  useEffect(() => {
    if (!detailItem) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailItem]);

  const openDetail = useCallback((item) => {
    track('store_item_detail', { itemId: item.id, game: item.game });
    setDetailItem(item);
  }, []);

  if (!open) return null;

  const filteredItems = SHOP_ITEMS.filter(
    (item) =>
      (shopGameFilter === 'all' || item.game === shopGameFilter) &&
      (shopCategoryFilter === 'all' || item.category === shopCategoryFilter) &&
      true
  );
  const items = filteredItems.length ? filteredItems : SHOP_ITEMS;
  const popular = items.slice(0, 4);
  const purchaseHistory = Array.isArray(inv.purchases) ? [...inv.purchases].reverse().slice(0, 6) : [];

  const buyItem = (item) => {
    if (item.free) return;
    if (item.id === 'mafia_extended') {
      const expiresAt = Date.now() + 30 * 24 * 3600 * 1000;
      setInv(setPro(expiresAt));
      track('store_checkout_mock', { itemId: item.id, plan: 'pro_30d' });
      return;
    }
    if (item.id.startsWith('spy_') || item.id.startsWith('elias_')) {
      setInv(purchaseDictionary(item.id));
      track('store_checkout_mock', { itemId: item.id, plan: 'dictionary_unlock' });
      return;
    }
    if (item.id.startsWith('td_') || item.id.startsWith('bunker_')) {
      setInv(unlockItem(item.id));
      track('store_checkout_mock', { itemId: item.id, plan: 'pack_unlock' });
      return;
    }
    setInv(addPurchaseHistory({ id: item.id, type: 'item' }));
    track('store_checkout_mock', { itemId: item.id, plan: 'item_unlock' });
  };

  function tryBuyItem(item, fromDetail) {
    if (!item || item.free) return;
    if (isBrowserGuestUser(user)) {
      if (fromDetail) setDetailItem(null);
      openAuthModal();
      track('store_pre_purchase_guest', { itemId: item.id });
      return;
    }
    buyItem(item);
    if (fromDetail) setDetailItem(null);
  }

  const restore = () => {
    const next = restorePurchases();
    setInv(next);
    track('store_restore', { hasPro: Boolean(next.hasPro), purchases: next.purchases?.length || 0 });
  };

  const renderItemCard = (item, keyPrefix) => {
    const hasPack = Array.isArray(inv.unlockedItems) && inv.unlockedItems.includes(item.id);
    const unlocked = item.free || inv.hasPro || hasPack;
    const locked = !unlocked;
    return (
      <div
        key={`${keyPrefix}-${item.id}`}
        role="button"
        tabIndex={0}
        className="shop-modal__item"
        style={{ marginBottom: 12, padding: 14, background: locked ? 'var(--gh-surface)' : 'var(--gh-surface-strong)', borderRadius: 10, position: 'relative', border: locked ? '1px dashed var(--gh-border)' : '1px solid var(--gh-border)' }}
        onClick={() => openDetail(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(item);
          }
        }}
      >
        {locked && (
          <Tooltip text="Премиум-контент (можно купить отдельно)">
            <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>🔒</div>
          </Tooltip>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{item.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {item.name}
              {item.free && <span style={{ fontSize: 12, color: '#8f8', marginLeft: 6 }}>Бесплатно</span>}
              {!item.free && unlocked && <span style={{ fontSize: 12, color: '#8f8', marginLeft: 6 }}>Открыто</span>}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{item.description}</div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>Нажмите, чтобы подробнее</div>
            {!item.free && !unlocked ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  track('store_item_click', { itemId: item.id, game: item.game, category: item.category });
                  tryBuyItem(item, false);
                }}
                className="gh-btn gh-btn--muted gh-btn--compact"
                style={{ width: 'auto', marginTop: 8 }}
              >
                Купить / открыть
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const detailMarketing = detailItem ? getShopItemMarketing(detailItem) : null;
  const detailHasPack = detailItem && Array.isArray(inv.unlockedItems) && inv.unlockedItems.includes(detailItem.id);
  const detailUnlocked = detailItem && (detailItem.free || inv.hasPro || detailHasPack);

  return (
    <div className="shop-modal-overlay" onClick={onClose}>
      <div className="shop-modal__panel" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Магазин и словари</h3>
        {isBrowserGuestUser(user) ? (
          <div
            style={{
              padding: 12,
              marginBottom: 14,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--gh-warning, #d4a017) 12%, var(--gh-surface, #222))',
              border: '1px dashed color-mix(in srgb, var(--gh-warning, #d4a017) 45%, transparent)',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <strong>Нужен вход.</strong> Покупки и премиум доступны после регистрации по почте или при игре через
            Telegram.
            <button type="button" className="gh-btn gh-btn--primary gh-btn--block" style={{ marginTop: 10 }} onClick={openAuthModal}>
              Войти или зарегистрироваться
            </button>
          </div>
        ) : null}
        <p style={{ fontSize: 13, marginBottom: 8 }}>Игра</p>
        <Select
          value={shopGameFilter}
          onChange={(e) => setShopGameFilter(e.target.value)}
          options={SHOP_GAMES.map((g) => ({ value: g.id, label: g.name }))}
          aria-label="Фильтр по игре"
          style={{ marginBottom: 14 }}
        />
        <p style={{ fontSize: 13, marginBottom: 8 }}>Категория</p>
        <Select
          value={shopCategoryFilter}
          onChange={(e) => setShopCategoryFilter(e.target.value)}
          options={SHOP_CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
          aria-label="Фильтр по категории"
          style={{ marginBottom: 10 }}
        />
        <div ref={listScrollRef} className="shop-modal__scroll">
          {popular.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.9 }}>Популярное</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {popular.map((item) => (
                  <div
                    key={`popular-${item.id}`}
                    role="button"
                    tabIndex={0}
                    className="shop-modal__item"
                    style={{ padding: 10, borderRadius: 8, background: 'var(--gh-surface-strong)', border: '1px solid var(--gh-border)', fontSize: 12 }}
                    onClick={() => openDetail(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(item);
                      }
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.emoji} {item.name}</div>
                    <div style={{ marginTop: 4, opacity: 0.85 }}>{item.free ? 'Бесплатно' : 'Премиум'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {items.length === 0 ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, opacity: 0.82 }}>
              По выбранным фильтрам ничего не найдено. Показаны все товары.
            </p>
          ) : (
            items.map((item) => renderItemCard(item, 'list'))
          )}
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.92 }}>Матрица ценности Премиум</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRO_VALUE_MATRIX.map((row) => (
                <div key={row.game} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{row.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Бесплатно: {row.free.join(', ')}</div>
                  <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>Премиум: {row.pro.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.92 }}>История покупок (локально)</p>
            {purchaseHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {purchaseHistory.map((p, idx) => (
                  <div key={`${p.id}-${p.t}-${idx}`} style={{ fontSize: 12, opacity: 0.9 }}>
                    {new Date(p.t).toLocaleString()} - {p.id}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Покупок пока нет.</p>
            )}
            {!isBrowserGuestUser(user) ? (
              <button type="button" onClick={restore} className="gh-btn gh-btn--muted gh-btn--compact" style={{ width: 'auto', marginTop: 8 }}>
                Восстановить покупки
              </button>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="gh-btn gh-btn--block" style={{ marginTop: 16 }}>
          Закрыть
        </button>

        {detailItem && detailMarketing ? (
          <div
            className="shop-modal-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-detail-title"
            onClick={() => setDetailItem(null)}
          >
            <div className="shop-modal-detail__card" onClick={(e) => e.stopPropagation()}>
              <h4 id="shop-detail-title">
                {detailItem.emoji} {detailItem.name}
              </h4>
              <p className="shop-modal-detail__intro">{detailMarketing.intro}</p>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, opacity: 0.9 }}>Что входит / как работает</p>
              <ul className="shop-modal-detail__list">
                {detailMarketing.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {detailMarketing.note ? <p className="shop-modal-detail__note">{detailMarketing.note}</p> : null}
              <div className="shop-modal-detail__actions">
                {!detailItem.free && !detailUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      tryBuyItem(detailItem, true);
                    }}
                    className="gh-btn gh-btn--block"
                  >
                    Купить / открыть
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="gh-btn gh-btn--muted gh-btn--block"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
