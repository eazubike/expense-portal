/**
 * Receipts Lambda handler.
 * Generates presigned URLs for S3 upload/download of receipt images.
 */

import { success, error } from '../utils/responses.js'

export const handler = async (event) => {
  const { httpMethod, pathParameters, body } = event

  try {
    switch (httpMethod) {
      case 'POST':
        return await getUploadUrl(JSON.parse(body))
      case 'GET':
        return await getDownloadUrl(pathParameters)
      case 'DELETE':
        return await deleteReceipt(pathParameters)
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Receipts handler error:', err)
    return error('Internal server error', 500)
  }
}

async function getUploadUrl(data) {
  // TODO: Generate presigned S3 PUT URL
  return success({ uploadUrl: '', key: '' })
}

async function getDownloadUrl(pathParams) {
  // TODO: Generate presigned S3 GET URL
  return success({ downloadUrl: '' })
}

async function deleteReceipt(pathParams) {
  // TODO: Delete receipt from S3
  return success({ message: 'Deleted' })
}
