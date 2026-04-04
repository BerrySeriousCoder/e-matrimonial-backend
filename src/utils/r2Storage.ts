import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export interface AttachmentMeta {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is not configured.');
  }
  return bucket;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Upload a file buffer to R2.
 * Returns metadata including the storage key (used to retrieve/delete later).
 */
export async function uploadAttachment(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  postId?: number
): Promise<AttachmentMeta> {
  const client = getR2Client();
  const bucket = getBucketName();

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uuid = crypto.randomUUID();
  const prefix = postId ? `attachments/${postId}` : 'attachments/general';
  const key = `${prefix}/${uuid}-${sanitizedFilename}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));

  return {
    key,
    filename,
    mimeType,
    sizeBytes: buffer.length,
  };
}

/**
 * Generate a time-limited signed URL for downloading an attachment from R2.
 * Default expiry: 1 hour.
 */
export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an attachment from R2.
 */
export async function deleteAttachment(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
}
