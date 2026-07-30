import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// PostgreSQL に接続するためのコネクションプールとアダプターを用意するぞ
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["query"] });

async function main() {
  // ユーザーを 1 件追加してみるのじゃ
  console.log("ユーザーを追加しておるぞ...");
  const newUser = await prisma.user.create({
    data: { name: `新しいわんこ ${new Date().toISOString()}` },
  });
  console.log("追加成功！:", newUser);

  // 全ユーザーを取得して表示するのじゃ
  const allUsers = await prisma.user.findMany();
  console.log("今のユーザー一覧:", allUsers);
}

main()
  .catch((e) => {
    console.error("エラーが発生したぞ:", e);
    process.exit(1);
  })
  .finally(() => {
    // prisma と pool の両方を閉じないとプロセスが終わらないので注意じゃ
    return Promise.all([prisma.$disconnect(), pool.end()]);
  });
