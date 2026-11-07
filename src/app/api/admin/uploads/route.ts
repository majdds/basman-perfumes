import { adminRoute } from "@/server/admin-route";
import { HttpError, json } from "@/server/http";
import { enforceIpLimit } from "@/server/services/rate-limit";
import { MAX_UPLOAD_BYTES, processProductImage } from "@/server/services/images";

/** Accepts ONE image per request as multipart/form-data field "file". */
export const POST = adminRoute(async (req) => {
  await enforceIpLimit(req, "upload");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, "file_too_large");
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw new HttpError(415, "unsupported_media_type");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "invalid_upload");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new HttpError(400, "invalid_upload");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "file_too_large");
  const image = await processProductImage(Buffer.from(await file.arrayBuffer()));
  return json(image, { status: 201 });
});
