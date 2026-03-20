# QA Smoke Regression Checklist

Quick pre-deploy checklist for core user flows.

## 1) Home / Lobby

- Open `/` and verify there is no runtime error in console.
- Create room as host.
- Join the same room from second client by invite link/code.
- Verify online/offline statuses update correctly.
- Verify leaving room returns to `/` without broken state.

## 2) Spy

- Start Spy from lobby.
- Verify role card loads for all players.
- If timer is enabled, verify countdown updates every second.
- Start vote as host and verify other players can vote once.
- End vote and verify result screen appears for everyone.
- Verify reconnect during round restores current card and vote state.

## 3) Mafia

- Start Mafia with default settings.
- Verify phase transitions and timer updates.
- Verify moderator can manually advance phase.
- Wait for timer timeout and verify auto-advance works once (no duplicate jumps).
- Verify vote submission is idempotent (second click does not break state).
- Verify reconnect restores current phase/state.

## 4) Elias

- Start Elias with default teams.
- Verify explaining team sees word, other team does not.
- Verify guessed/skip actions update score and word.
- Verify next-turn flow works at timeout.
- Verify reconnect restores current round and timer.

## 5) Truth or Dare

- Start Truth/Dare from lobby with default categories.
- Verify current player, timer and card are visible.
- Verify `done` and `skip` actions advance turn once.
- Enable 18+ and verify age confirmation flow works per player.
- Verify reconnect restores current turn and card state.

## 6) Bunker

- Start Bunker with 4+ players.
- Verify phase progression: intro -> reveals -> discussion -> voting.
- Verify voting works and tie-break resolves.
- Verify round event and eliminated log are shown.
- Verify final screen appears with winner.
- Verify reconnect restores current phase/timer.

## 7) Stability / API errors

- Temporarily stop server and verify app shows stable fallback behavior.
- Trigger invalid actions (e.g. vote outside voting phase) and verify user-friendly error message.
- Verify no persistent loading spinner loops after recoverable API errors.

## 8) Deployment gate

- Run frontend build (`app`: `npm run build`) before deploy.
- Confirm no new linter diagnostics in modified files.
- Perform at least one end-to-end smoke pass for Home + 2 game modes.
