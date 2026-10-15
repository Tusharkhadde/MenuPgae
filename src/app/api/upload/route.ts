import { NextResponse } from "next/server";
import { validateImage } from "@/lib/image-validate";
import { storeImage, StorageNotConfiguredError } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { findAccessibleRestaurant, getSessionUser } from "@/server/session";
import { roleAtLeast } from "@/lib/roles";
import { isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 40, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many uploads. Wait a few minutes and try again." }, { status: 429 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4.5 * 1024 * 1024) return NextResponse.json({ error: "Images must be 4 MB or smaller." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  const restaurantId = form.get("restaurantId");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });

  let folder = `u/${user.id}`;
  if (typeof restaurantId === "string" && restaurantId) {
    const found = await findAccessibleRestaurant(user, restaurantId);
    const r = found && roleAtLeast(found.role, "manager") ? found.restaurant : null;
    if (!r) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    folder = `r/${r.id}`;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImage(bytes);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  try {
    const url = await storeImage({ bytes, type: check.type, folder });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    console.error("[menupage] upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
