/*
  Warnings:

  - You are about to drop the `DriverBankDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DriverBankDetails" DROP CONSTRAINT "DriverBankDetails_driverId_fkey";

-- DropTable
DROP TABLE "DriverBankDetails";
