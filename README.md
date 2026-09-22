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

## 検査

```powershell
node test.mjs
```
