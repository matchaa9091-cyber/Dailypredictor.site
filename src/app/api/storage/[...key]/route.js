import { NextResponse } from 'next/server';
import { getR2Bucket, uploadToR2, deleteFromR2 } from '../../../../lib/storage';

// ── GET /api/storage/[...key] ────────────────────────────────────────────────
// Streams the object directly from the Cloudflare R2 bucket to the client.
export async function GET(req, { params }) {
  try {
    const bucket = await getR2Bucket();
    if (!bucket) {
      return NextResponse.json({ error: "R2 bucket not available" }, { status: 503 });
    }

    const { key } = await params;
    const objectKey = Array.isArray(key) ? key.join('/') : key;

    const object = await bucket.get(objectKey);
    if (!object) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (err) {
    console.error("[R2 GET Error]:", err);
    return NextResponse.json({ error: "Failed to fetch file", details: err.message }, { status: 500 });
  }
}

// ── POST /api/storage/[...key] ───────────────────────────────────────────────
// Uploads a file to R2 at the specified key.
export async function POST(req, { params }) {
  try {
    const bucket = await getR2Bucket();
    if (!bucket) {
      return NextResponse.json({ error: "R2 bucket not available" }, { status: 503 });
    }

    const { key } = await params;
    const objectKey = Array.isArray(key) ? key.join('/') : key;

    const contentType = req.headers.get('content-type') || 'application/octet-stream';
    const bodyBuffer = await req.arrayBuffer();

    await uploadToR2(objectKey, bodyBuffer, contentType);

    const publicUrl = `/api/storage/${objectKey}`;
    return NextResponse.json({
      success: true,
      key: objectKey,
      url: publicUrl,
    });
  } catch (err) {
    console.error("[R2 POST Error]:", err);
    return NextResponse.json({ error: "Upload failed", details: err.message }, { status: 500 });
  }
}

// ── DELETE /api/storage/[...key] ─────────────────────────────────────────────
export async function DELETE(req, { params }) {
  try {
    const bucket = await getR2Bucket();
    if (!bucket) {
      return NextResponse.json({ error: "R2 bucket not available" }, { status: 503 });
    }

    const { key } = await params;
    const objectKey = Array.isArray(key) ? key.join('/') : key;

    await deleteFromR2(objectKey);
    return NextResponse.json({ success: true, message: "File deleted" });
  } catch (err) {
    console.error("[R2 DELETE Error]:", err);
    return NextResponse.json({ error: "Delete failed", details: err.message }, { status: 500 });
  }
}
