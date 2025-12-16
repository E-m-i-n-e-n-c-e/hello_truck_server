/*
  Warnings:

  - Added the required column `wasPaid` to the `RefundIntent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RefundIntent" ADD COLUMN     "wasPaid" BOOLEAN NOT NULL;
