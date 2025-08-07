/*
  Warnings:

  - Made the column `vehicleImageUrl` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "vehicleImageUrl" SET NOT NULL;
