import { Expose } from "class-transformer";
import { IsString } from "class-validator";

export class uploadUrlDto {
  @IsString()
  filePath: string;

  @IsString()
  type: string;
}

export class UploadUrlResponseDto {
  @Expose()
  signedUrl: string;
  @Expose()
  publicUrl: string;
  @Expose()
  token: string;
}