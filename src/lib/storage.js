import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Retrieves the Cloudflare R2 bucket instance from the Edge request context.
 */
export function getR2Bucket() {
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && ctx.env.BUCKET) {
      return ctx.env.BUCKET;
    }
  } catch {
    // Outside of edge context
  }
  return null;
}

/**
 * Uploads an ArrayBuffer/Blob/ReadableStream to Cloudflare R2
 */
export async function uploadToR2(key, data, contentType = 'application/octet-stream') {
  const bucket = getR2Bucket();
  if (!bucket) {
    throw new Error("R2 BUCKET binding not found in request context.");
  }
  return await bucket.put(key, data, {
    httpMetadata: {
      contentType,
    },
  });
}

/**
 * Retrieves an object from Cloudflare R2
 */
export async function getFromR2(key) {
  const bucket = getR2Bucket();
  if (!bucket) {
    throw new Error("R2 BUCKET binding not found in request context.");
  }
  return await bucket.get(key);
}

/**
 * Deletes an object from Cloudflare R2
 */
export async function deleteFromR2(key) {
  const bucket = getR2Bucket();
  if (!bucket) {
    throw new Error("R2 BUCKET binding not found in request context.");
  }
  return await bucket.delete(key);
}
