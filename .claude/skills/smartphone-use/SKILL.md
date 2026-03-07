---
name: smartphone-use
description: DroidRunとLMStudioでadb接続したAndroid端末を自然言語で操作する。
---

# Smartphone Use

## 概要

adb接続したAndroid端末を操作する。スクショ/UIのXMLはQwen3.5（LMStudio）が処理し、Opusにはテキスト要約のみ返す。

## 前提条件

- adb がインストール済みで、Android端末が接続されていること（`adb devices` で確認）
- LMStudio が起動中であること（ポート1234、モデルはJITロード）
- DroidRun が python3.11 にインストール済み（`do` コマンド用）
- DroidRun Portal が端末にセットアップ済み（`python3.11 -m droidrun setup`）

## コマンド一覧

### look - 画面を見る

```bash
./.claude/skills/smartphone-use/scripts/look.sh
```

Qwen3.5がUI要素を読み取り、画面の状態をテキストで報告する。

### open - アプリ起動

```bash
./.claude/skills/smartphone-use/scripts/open.sh "Gmail"
./.claude/skills/smartphone-use/scripts/open.sh "com.google.android.gm"
```

アプリを起動し、1.5秒後に画面状態を報告する。アプリ名またはパッケージ名で指定。

### home - ホームに戻る

```bash
./.claude/skills/smartphone-use/scripts/home.sh
```

ホームボタンを押し、1秒後に画面状態を報告する。

### back - 戻る

```bash
./.claude/skills/smartphone-use/scripts/back.sh
```

戻るボタンを押し、1秒後に画面状態を報告する。

### do - 短い操作を実行

```bash
./.claude/skills/smartphone-use/scripts/do.sh "送信ボタンを押して"
./.claude/skills/smartphone-use/scripts/do.sh "検索バーに「天気」と入力して検索" 5
```

DroidRun（Qwen3.5）に短い指示を投げて実行する。デフォルト最大5ステップ。

### run - フル実行（従来互換）

```bash
./.claude/skills/smartphone-use/scripts/run.sh "設定アプリを開いてバッテリー残量を教えて"
```

DroidRunにまとまった目標を渡して自律実行する。

## 設計思想

- **Opus（Claude）** → 判断層。テキストだけ受け取り、次のアクションを決める
- **Qwen3.5（LMStudio）** → 実行層。スクショ/UI XMLの重いトークンを処理する防波堤
- 全コマンドの出力はテキストのみ。スクショやUI XMLがOpusのコンテキストに入ることはない

## 複数台接続時

```bash
DEVICE_SERIAL="44224424" ./.claude/skills/smartphone-use/scripts/look.sh
```
