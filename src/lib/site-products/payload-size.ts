export const MAX_SITE_PRODUCT_PUBLISH_PAYLOAD_BYTES = 4 * 1024 * 1024;

export function getJsonSizeInBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
