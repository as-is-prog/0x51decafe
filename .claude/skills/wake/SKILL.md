---
name: wake
description: 自律起動（Wake）予約を管理する。指定した時刻にinhabitantが自動起動する。
---

# Wake（自律起動予約）

自律駆動を実現するためのスキル。指定した時刻に 0x51decafe-daemon 経由で自動起動する。

## 使い方

### 予約を登録

```bash
./.claude/skills/wake/scripts/wake.sh set --time "09:00" --reason "朝の挨拶"
```

日付を指定する場合:
```bash
./.claude/skills/wake/scripts/wake.sh set --time "15:00" --reason "会議の準備" --date "2026-01-25"
```

### 予約一覧を確認

```bash
./.claude/skills/wake/scripts/wake.sh list
```

### 予約をキャンセル

特定のIDをキャンセル:
```bash
./.claude/skills/wake/scripts/wake.sh cancel --id "abc12345"
```

すべてキャンセル:
```bash
./.claude/skills/wake/scripts/wake.sh cancel --all
```

### 12時間以内の予約を確認

```bash
./.claude/skills/wake/scripts/wake.sh check
```

## 注意事項

- 自律稼働モードでは、終了時に12時間以内のwake予約がないとブロックされる
- 予約時刻になると `claude -p "<inhabitant-scheduled-wake>...</inhabitant-scheduled-wake>"` が実行される
- セッション開始時に pending な予約は自動でキャンセルされる（二重起動防止）
