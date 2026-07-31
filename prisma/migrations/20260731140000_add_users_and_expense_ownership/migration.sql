-- 既存の確認用データには所有者がいないため、一度空にして利用者別管理へ移行する。
TRUNCATE TABLE "expenses" RESTART IDENTITY;

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "expenses" ADD COLUMN "user_id" INTEGER NOT NULL;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
