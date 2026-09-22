# Salesforce Admin Drill

Salesforce Platform Administrator 試験対策用の PWA です。

## 起動

静的 Web サーバーでこのフォルダーを配信します。

```powershell
node server.mjs
```

## 主な機能

- 全150問の学習
- 60問のランダム模擬試験
- 間違えた問題の復習
- ブックマーク
- 回答後の解説表示
- 端末内への学習履歴保存
- PWA としてホーム画面へ追加

問題は `Salesforce_Admin_Practice_Questions_Draft.md` から読み込まれます。
学習メモは `Salesforce_Admin_Study_Notes.md` から読み込まれます。
一次インプットは `Salesforce_Admin_Input_Notes.md` に蓄積します。

## 更新運用

ユーザーから新しいインプットが追加された場合は、次の順で更新します。

1. `Salesforce_Admin_Input_Notes.md` に追記する。
2. 必要な問題を `Salesforce_Admin_Practice_Questions_Draft.md` に追加または修正する。
3. 読み物として理解できるように `Salesforce_Admin_Study_Notes.md` を更新する。
4. 問題数、正答表、メモ見出しを `node test.mjs` で検査する。
5. GitHub Pages へ反映する。

## 検査

```powershell
node test.mjs
```
