/**
 * S3 client and presigned URL helpers.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({})

const STAGE = process.env.STAGE || 'test'
const BUCKET = process.env.RECEIPTS_BUCKET || `expense-tracker-receipts-${STAGE}`

export async function getUploadPresignedUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3Client, command, { expiresIn: 300 }) // 5 minutes
}

export async function getDownloadPresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
}

export async function deleteObject(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }))
}

export { s3Client }
