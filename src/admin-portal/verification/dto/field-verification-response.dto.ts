import { Expose } from 'class-transformer';

export class UploadPhotosResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  photosUploaded: number;
}

export class GetSignedUrlResponseDto {
  @Expose()
  signedUrl: string;

  @Expose()
  publicUrl: string;

  @Expose()
  token: string;

  @Expose()
  filePath: string;

  @Expose()
  expiresIn: number;
}
