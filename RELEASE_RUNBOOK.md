# Release Runbook

## 1) Before Deploy
- Confirm current branch is stable and smoke checklist is green.
- Verify `app` build succeeds.
- Verify critical routes: `/`, `/lobby`, `/spy`, `/mafia`, `/elias`, `/truth_dare`, `/bunker`.
- Confirm analytics ingestion still writes local queue.

## 2) Feature Flags (minimal process)
- Roll out risky UX in stages (invites, paywall, reconnect behavior).
- Keep one rollback switch per major feature group:
  - Invite flow fallback
  - Paywall/store interactions
  - Realtime reconnect indicators

## 3) Deploy Window
- Deploy during monitored window (team member online).
- Watch first 10-15 minutes:
  - app startup success
  - room create/join conversion
  - api error timeout spikes

## 4) Rollback Rule (<= 5 minutes)
- Roll back immediately if:
  - homepage does not render,
  - room create/join broken,
  - game routes crash for majority of users.
- Rollback target: last known good release.
- Communicate in one message: reason, impact, ETA for fixed redeploy.

## 5) After Deploy
- Run quick smoke on Home + Lobby + one game.
- Check invite join, reconnect, and rematch flows once.
- Update changelog summary.
