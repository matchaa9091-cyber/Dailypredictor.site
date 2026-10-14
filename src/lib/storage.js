import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Retrieves the Cloudflare R2 bucket instance from the Cloudflare context.
 */
export async function getR2Bucket() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx && ctx.env && ctx.env.BUCKET) {
      return ctx.env.BUCKET;
    }
  } catch {
    try {
      const ctx = getCloudflareContext();
      if (ctx && ctx.env && ctx.env.BUCKET) {
        return ctx.env.BUCKET;
      }
    } catch {
      // Outside of Cloudflare context
    }
  }
  return null;
}

/**
 * Uploads an ArrayBuffer/Blob/ReadableStream to Cloudflare R2
 */
export async function uploadToR2(key, data, contentType = 'application/octet-stream') {
  const bucket = await getR2Bucket();
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
  const bucket = await getR2Bucket();
  if (!bucket) {
    throw new Error("R2 BUCKET binding not found in request context.");
  }
  return await bucket.get(key);
}

/**
 * Deletes an object from Cloudflare R2
 */
export async function deleteFromR2(key) {
  const bucket = await getR2Bucket();
  if (!bucket) {
    throw new Error("R2 BUCKET binding not found in request context.");
  }
  return await bucket.delete(key);
}
