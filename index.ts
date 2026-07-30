import "dotenv/config";
import path from "node:path";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL が設定されていません。");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 8888;

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.render("index");
});

app.get("/expenses", async (_req, res) => {
  const expenses = await prisma.expense.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  res.json(expenses);
});

app.get("/expenses/summary", async (req, res) => {
  const month =
    typeof req.query.month === "string"
      ? req.query.month
      : new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "month は YYYY-MM 形式で指定してください。" });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    return res.status(400).json({ message: "正しい月を指定してください。" });
  }

  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNumber, 1));
  const result = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: {
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
  });

  res.json({ month, total: result._sum.amount ?? 0 });
});

app.post("/expenses", async (req, res) => {
  const amount = Number(req.body.amount);
  const category = String(req.body.category ?? "").trim();
  const dateText = String(req.body.date ?? "");
  const memoText = String(req.body.memo ?? "").trim();
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const isValidDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateText) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === dateText;

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ message: "金額は1円以上の整数で入力してください。" });
  }
  if (!category || category.length > 100) {
    return res.status(400).json({ message: "カテゴリを正しく入力してください。" });
  }
  if (!isValidDate) {
    return res.status(400).json({ message: "日付を正しく入力してください。" });
  }
  if (memoText.length > 500) {
    return res.status(400).json({ message: "メモは500文字以内で入力してください。" });
  }

  const expense = await prisma.expense.create({
    data: {
      amount,
      category,
      date,
      memo: memoText || null,
    },
  });

  res.status(201).json(expense);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "サーバーでエラーが発生しました。" });
});

app.listen(PORT, () => {
  console.log(`家計簿アプリを起動しました: http://localhost:${PORT}`);
});
