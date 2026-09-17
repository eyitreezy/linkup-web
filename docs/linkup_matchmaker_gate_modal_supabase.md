# MatchMaker Gate Modal — Supabase Migration

Run this migration **before** deploying the gate modal UI:

```
supabase/migrations/20260903000001_matchmaker_gate_modal.sql
```

## What it adds

### `matchmaker_get_gate_state()` (updated)

Returns:

| Field | When |
|---|---|
| `gate: 'subscription'` | No Gold/Platinum access |
| `gate: 'kyc'` | Not verified |
| `gate: 'suspended'` | `matchmaker_cooldowns.reason = 'contact_sharing'` + `suspension_until` |
| `gate: 'cooldown'` | Other cooldown reasons (e.g. rapid cycler) + `cooldown_until` |
| `gate: 'intent'` | No active intent declaration |
| `gate: 'values'` | No values setup |
| `gate: 'connection'` | Active/paused connection + `connection_id` |
| `gate: 'open'` | Pool accessible |

### `matchmaker_get_pool_preview(p_limit)` (new)

Returns up to 6 real pool profiles for blurred preview behind gate modals. Does not require viewer to pass gates.

## Apply

```bash
supabase db push
```

Or paste `20260903000001_matchmaker_gate_modal.sql` into the Supabase SQL Editor.
