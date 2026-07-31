import "dotenv/config";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
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
const SESSION_COOKIE = "kakeibo_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const sessionSecret = process.env.SESSION_SECRET || connectionString;

type AuthenticatedRequest = Request & { userId: number };

const createSessionToken = (userId: number) => {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

const getSessionUserId = (req: Request) => {
  const cookieHeader = req.headers.cookie ?? "";
  const token = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest();
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { userId?: unknown; expiresAt?: unknown };
    return Number.isSafeInteger(session.userId) &&
      typeof session.expiresAt === "number" &&
      session.expiresAt > Date.now() / 1000
      ? (session.userId as number)
      : null;
  } catch {
    return null;
  }
};

const setSessionCookie = (res: Response, userId: number) => {
  res.cookie(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE * 1000,
    path: "/",
  });
};

const requirePageLogin = (req: Request, res: Response, next: NextFunction) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.redirect("/login");
  (req as AuthenticatedRequest).userId = userId;
  next();
};

const requireApiLogin = (req: Request, res: Response, next: NextFunction) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "ログインしてください。" });
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
};

const normalizeEmail = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const validateCredentials = (email: string, password: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return "正しいメールアドレスを入力してください。";
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return "パスワードは8文字以上72バイト以内で入力してください。";
  }
  return null;
};

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/login", (req, res) => {
  if (getSessionUserId(req)) return res.redirect("/");
  res.render("auth", { mode: "login", error: null, email: "" });
});

app.get("/register", (req, res) => {
  if (getSessionUserId(req)) return res.redirect("/");
  res.render("auth", { mode: "register", error: null, email: "" });
});

app.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? "");
  const error = validateCredentials(email, password);
  if (error) {
    return res.status(400).render("auth", { mode: "register", error, email });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).render("auth", {
      mode: "register",
      error: "このメールアドレスはすでに登録されています。",
      email,
    });
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 12) },
  });
  setSessionCookie(res, user.id);
  res.redirect("/");
});

app.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).render("auth", {
      mode: "login",
      error: "メールアドレスまたはパスワードが違います。",
      email,
    });
  }

  setSessionCookie(res, user.id);
  res.redirect("/");
});

app.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect("/login");
});

app.get("/", requirePageLogin, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: (req as AuthenticatedRequest).userId },
    select: { email: true },
  });
  res.render("index", { email: user.email });
});

app.get("/expenses", requireApiLogin, async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { userId: (req as AuthenticatedRequest).userId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  res.json(expenses);
});

app.get("/expenses/summary", requireApiLogin, async (req, res) => {
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
      userId: (req as AuthenticatedRequest).userId,
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
  });

  res.json({ month, total: result._sum.amount ?? 0 });
});

app.post("/expenses", requireApiLogin, async (req, res) => {
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
      userId: (req as AuthenticatedRequest).userId,
    },
  });

  res.status(201).json(expense);
});

app.delete("/expenses/:id", requireApiLogin, async (req, res) => {
  const idText = String(req.params.id ?? "");
  const id = Number(idText);

  if (!/^\d+$/.test(idText) || !Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ message: "支出IDが正しくありません。" });
  }

  const result = await prisma.expense.deleteMany({
    where: { id, userId: (req as AuthenticatedRequest).userId },
  });

  if (result.count === 0) {
    return res.status(404).json({ message: "削除する支出が見つかりません。" });
  }

  res.json({ message: "支出を削除しました。" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "サーバーでエラーが発生しました。" });
});

app.listen(PORT, () => {
  console.log(`家計簿アプリを起動しました: http://localhost:${PORT}`);
});
