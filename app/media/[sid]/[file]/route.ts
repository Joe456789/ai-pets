import { mediaSize, mediaType, parseRange, readMediaRange, readPhoto } from "@/lib/media";

export async function GET(req: Request, { params }: { params: Promise<{ sid: string; file: string }> }) {
  const { sid, file } = await params;
  const size = await mediaSize(sid, file);
  if (size === null) return new Response("Not found", { status: 404 });
  const base = {
    "Content-Type": mediaType(file),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  if (range) {
    const data = await readMediaRange(sid, file, range.start, range.end);
    return new Response(new Uint8Array(data), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(data.length) },
    });
  }
  const data = await readPhoto(sid, file);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { ...base, "Content-Length": String(data.length) } });
}
