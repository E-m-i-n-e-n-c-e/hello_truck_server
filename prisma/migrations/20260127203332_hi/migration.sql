-- AddForeignKey
ALTER TABLE "public"."DriverVerificationRequest" ADD CONSTRAINT "DriverVerificationRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
