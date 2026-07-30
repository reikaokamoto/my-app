-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" SERIAL NOT NULL,
    "item" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);
