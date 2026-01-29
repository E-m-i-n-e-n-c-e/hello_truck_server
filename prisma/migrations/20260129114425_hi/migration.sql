-- AddForeignKey
ALTER TABLE "public"."DriverVerificationRequest" ADD CONSTRAINT "DriverVerificationRequest_revertRequestedById_fkey" FOREIGN KEY ("revertRequestedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
