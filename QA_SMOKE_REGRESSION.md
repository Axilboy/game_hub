# QA Smoke Regression Checklist

Pre-release checklist for critical flows, realtime stability, and rollback readiness.

## 1) Core App (Home / Lobby / Invite)

- Open `/` and verify there is no runtime error in console.
- Create room as host, join from second client by code and invite.
- Verify invite share works: Telegram share, native share, clipboard fallback.
- Verify invalid/expired invite shows fallback CTA block (code/create/rematch).
- Verify online/offline status badges update in lobby.
- Verify leaving room returns to `/` without stale room state.

## 2) Game Modes

### Spy
- Start game with default settings.
- Verify role card and location list behavior.
- Verify vote start/end and idempotent vote submit.
- Verify reconnect restores vote/card state.

### Mafia
- Start with default timers and with "10-minute mode".
- Verify phase transitions and timer countdown.
- Verify auto-advance triggers once (no duplicate jumps).
- Verify vote protocol and revealed roles rendering.

### Elias
- Verify active team/explainer indicators.
- Verify guessed/skip score update and skip penalty.
- Verify timeout -> next turn flow and scoreboard/MVP updates.

### Truth or Dare
- Verify categories, mode, and timer state.
- Verify turn idempotency (`done`/`skip`) and reconnect restore.
- Verify 18+ confirm per player and safe-mode visibility.
- Verify card feedback actions (`like` / `favorite` / `report`) and host moderation list refresh.
- Verify premium category access works both via Pro and via purchased pack items (`td_party`, `td_romance`, `td_18plus`).

### Bunker
- Verify intro/reveals/discussion/voting/tie-break phases.
- Verify vote counts, eliminated log, final state.
- Verify reconnect and phase timer restore.
- Verify post-match report includes survival status and crisis history list.
- Run one high-load room with 8-12 players (or bots) and ensure no duplicate phase jumps.

## 3) Monetization / Store

- Open paywall from Home and validate value-first copy.
- Check mock checkout actions (unlock/trial/restore) update local inventory.
- Verify purchase history is appended and rendered.
- Verify events: `paywall_open`, `paywall_buy_click`, `store_checkout_mock`, `store_restore`.

## 4) Analytics / Observability

- Verify funnel counters in Profile are updated after one full game cycle.
- Verify KPI lines (invite split, store CTR, api errors/timeouts) are visible.
- Force a timeout/error and verify `api_error` event includes timeout marker.

## 5) SEO Surface

- Verify `/games/spy`, `/games/elias`, `/games/mafia`, `/games/truth_dare`, `/games/bunker`; `/seo` and `/how-to-play` redirect to `/`.
- Verify internal links and back-navigation work.
- Verify title/description render and no blank content sections.

## 6) A11y / Motion

- Keyboard through Home/Lobby controls, modal open/close, focus trap.
- Verify `aria-live`/alert messages for critical error states.
- Verify 44px hit targets for icon controls.
- Verify reduced-motion mode does not break usability.

## 7) Devices / Network

- Check at least 5 contexts: Android WebView, iOS Safari, desktop Chrome, desktop Firefox, low-end Android.
- Test with stable network, slow 3G simulation, and offline->online recovery.
- Verify reconnect banner and offline banner behavior.

## 8) Release Gate

- Run frontend build (`app`: `npm run build`) and verify success.
- Ensure no new linter diagnostics in modified files.
- Run one 2-player e2e smoke (Home -> Lobby -> Game -> End -> Rematch).
- Prepare rollback trigger and responsible person before deploy.
