#!/usr/bin/env python3.11
"""画面の状態を Qwen3.5 に読ませてテキスト要約を返す。
スクショ/UI XML は Opus に渡さず、Qwen3.5 の中で閉じる。
"""

import json
import subprocess
import sys
import urllib.request


LMSTUDIO_URL = "http://localhost:1234/v1/chat/completions"
MODEL = "qwen3.5-9b-uncensored-hauhaucs-aggressive"

SYSTEM_PROMPT = """\
Android画面のUI XMLを読み、以下のフォーマットだけを出力せよ。
フォーマット以外の出力は一切するな。

[REPORT]
app: アプリ名
screen: 画面の種類
content: 表示内容の要約
buttons: ボタン名1, ボタン名2, ..."""


REMOTE_DUMP_PATH = "/sdcard/ui_dump.xml"


def get_ui_dump(serial: str | None = None) -> str:
    """adb uiautomator dump で UI 要素を取得（ファイル経由）"""
    adb = ["adb"]
    if serial:
        adb += ["-s", serial]
    # dump to file on device
    subprocess.run(adb + ["shell", "uiautomator", "dump", REMOTE_DUMP_PATH],
                   capture_output=True, text=True, timeout=10)
    # read the file
    result = subprocess.run(adb + ["shell", "cat", REMOTE_DUMP_PATH],
                            capture_output=True, text=True, timeout=10)
    return result.stdout


def ask_qwen(ui_xml: str) -> str:
    """LMStudio の Qwen3.5 に UI XML を渡してテキスト要約を得る"""
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"以下のUI要素から画面を説明してください:\n\n{ui_xml}"},
            {"role": "assistant", "content": "[REPORT]\napp:"},
        ],
        "temperature": 0.3,
        "max_tokens": 300,
    }).encode()

    req = urllib.request.Request(
        LMSTUDIO_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())

    content = data["choices"][0]["message"]["content"]
    import re
    # <think>...</think> タグを除去
    content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL)
    # assistant prefill "app:" の続きなので、先頭に "app:" を補完
    # thinking が混入した場合は最初の "app:" 以降を抽出
    if not content.startswith("app:"):
        match = re.search(r"(app:.+)", content, flags=re.DOTALL)
        content = match.group(1) if match else content
    if not content.startswith("app:"):
        content = "app:" + content
    return content.strip()


def main():
    serial = sys.argv[1] if len(sys.argv) > 1 else None
    ui_xml = get_ui_dump(serial)
    if not ui_xml.strip():
        print("ERROR: UI dump が取得できませんでした", file=sys.stderr)
        sys.exit(1)
    summary = ask_qwen(ui_xml)
    print(summary)


if __name__ == "__main__":
    main()
