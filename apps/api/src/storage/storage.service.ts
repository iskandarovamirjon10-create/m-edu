import * as path from 'path';
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'medu-private-storage';
    
    // Standard AWS environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    
    this.s3Client = new S3Client({
      region,
      ...(this.configService.get<string>('AWS_ACCESS_KEY_ID') && this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
        ? {
            credentials: {
              accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
              secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
            },
          }
        : {}),
    });
  }

  /**
   * Generates a pre-signed URL for uploading a file directly to S3.
   * Enforces tenant isolation by prepending organizationId to the object key.
   */
  async getUploadUrl(organizationId: string, fileName: string, mimeType: string, expiresInSeconds = 300) {
    // Generate a secure, unique path: orgId/timestamp-filename
    const timestamp = Date.now();
    // Sanitize filename to prevent path traversal and dangerous character injections
    const base = path.basename(fileName);
    const sanitizedBase = base.replace(/[\0\x00-\x1f\x7f]/g, '').trim().replace(/^\.+/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = sanitizedBase.length > 0 ? sanitizedBase : 'file.bin';
    const objectKey = `${organizationId}/${timestamp}-${safeFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      
      return {
        uploadUrl,
        objectKey,
        expiresIn: expiresInSeconds,
      };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }

  /**
   * Generates a pre-signed URL for downloading/viewing a file from S3.
   * Must ONLY be called after authorizing the user's access to the document.
   */
  async getDownloadUrl(objectKey: string, expiresInSeconds = 300) {
    try {
      // Legacy support: if it's already an absolute HTTP URL, just return it.
      if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
        return objectKey;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      return downloadUrl;
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Could not generate download URL');
    }
  }
}
