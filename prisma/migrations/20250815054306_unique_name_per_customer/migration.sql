/*
  Warnings:

  - A unique constraint covering the columns `[name,customerId]` on the table `SavedAddress` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_name_customerId_key" ON "SavedAddress"("name", "customerId");
