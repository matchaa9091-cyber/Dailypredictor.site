import { NextResponse } from 'next/server';
import { getR2Bucket, uploadToR2 } from '../../../../lib/storage';

export const runtime = 'edge';

// ── POST /api/storage/upload ────────────────────────────────────────────────
// Accepts multipart/form-data with a "file" field and optional "folder"
export async function POST(req) {
  try {
    const bucket = getR2Bucket();
    if (!bucket) {
      return NextResponse.json({ error: "R2 bucket not available in request context" }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: "No valid file provided in 'file' field" }, { status: 400 });
    }

    const folder = (formData.get('folder') || 'uploads').toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${Date.now()}_${cleanFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'application/octet-stream';

    await uploadToR2(key, arrayBuffer, contentType);

    const publicUrl = `/api/storage/${key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key,
      size: file.size,
      type: contentType
    });
  } catch (err) {
    console.error("[Upload Route Error]:", err);
    return NextResponse.json({ error: "Upload failed", details: err.message }, { status: 500 });
  }
}
