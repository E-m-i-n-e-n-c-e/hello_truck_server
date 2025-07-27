/*
  Warnings:

  - You are about to drop the column `userName` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "userName",
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;
