// Old browser tabs can finish an operation after deployment. Keep their API
// field names at this boundary; new components and ORM use domain field names.
const legacyFields = { specifications: "location", listingType: "feeling", priceLabel: "pollQuestion" } as const;
export function normalizePostMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid post metadata");
  const body: Record<string, unknown> = { ...input };
  for (const [current, previous] of Object.entries(legacyFields)) {
    if (!Object.hasOwn(body, current) && Object.hasOwn(body, previous)) body[current] = body[previous];
    delete body[previous];
  }
  return body;
}
export function postWithLegacyMetadata<T extends { specifications?: unknown; listingType?: unknown; priceLabel?: unknown }>(post: T) {
  return { ...post, [legacyFields.specifications]: post.specifications, [legacyFields.listingType]: post.listingType, [legacyFields.priceLabel]: post.priceLabel };
}
