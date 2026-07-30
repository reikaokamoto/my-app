DROP TABLE IF EXISTS "Record";
DROP TABLE IF EXISTS "User";

CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "memo" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
