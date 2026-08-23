import { supabase } from "@/lib/supabase/client";

const PRODUCT_IMAGE_BUCKET = "catalog-product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const extensionForMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface CatalogImageScope {
  businessId: string;
  locationId: string;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function validateCatalogProductImage(file: File): string | null {
  if (!(file.type in extensionForMimeType)) {
    return "Choose a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "Image files must be 5 MB or smaller.";
  }
  return null;
}

export async function uploadCatalogProductImage(
  scope: CatalogImageScope,
  productId: string,
  file: File,
) {
  const validationError = validateCatalogProductImage(file);
  if (validationError) throw new Error(validationError);

  const extension = extensionForMimeType[file.type];
  const path = `${scope.businessId}/${scope.locationId}/${productId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
  throwIfError(uploadError);

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function managedPathFromUrl(scope: CatalogImageScope, imageUrl: string) {
  const urlWithoutQuery = imageUrl.split("?")[0];
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = urlWithoutQuery.indexOf(marker);
  if (markerIndex === -1) return null;
  const path = urlWithoutQuery.slice(markerIndex + marker.length);
  const expectedPrefix = `${scope.businessId}/${scope.locationId}/`;
  if (!path.startsWith(expectedPrefix)) return null;
  return path.split("/").length === 4 ? path : null;
}

export async function deleteCatalogProductImage(
  scope: CatalogImageScope,
  imageUrl: string | undefined,
) {
  if (!imageUrl) return;
  const path = managedPathFromUrl(scope, imageUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  throwIfError(error);
}

export async function deleteCatalogProductImagePaths(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
  throwIfError(error);
}
