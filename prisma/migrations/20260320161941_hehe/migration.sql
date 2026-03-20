-- AddForeignKey
ALTER TABLE "public"."field_verification_photos" ADD CONSTRAINT "field_verification_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
