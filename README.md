# 家計簿Webアプリ

EJS＋JavaScriptの画面、Express＋TypeScriptのAPI、Prisma＋PostgreSQLの3層構成です。

## 機能

- 支出の登録（金額、カテゴリ、日付、メモ）
- 支出一覧の表示
- 今月の支出合計の表示

## ローカル起動

Node.js v22を使用します。

```bash
npm install
npm run db:dev
```

`prisma dev` が表示した接続先を `.env` の `DATABASE_URL` に設定し、別のターミナルで以下を実行します。

```bash
npm run db:migrate
npm start
```

`http://localhost:8888` を開いてください。

## API

- `GET /expenses`：支出一覧
- `POST /expenses`：支出登録
- `GET /expenses/summary?month=YYYY-MM`：月ごとの合計

RenderではPostgreSQLの接続URLを環境変数 `DATABASE_URL` に設定し、デプロイ前に `npm run db:deploy` を実行します。
