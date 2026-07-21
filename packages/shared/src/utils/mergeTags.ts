const MERGE_TAGS = [
  "first_name",
  "property",
  "host_name",
  "dates",
  "quote_link",
  "unsub_link",
  "season",
] as const;

export type MergeTag = (typeof MERGE_TAGS)[number];
export type MergeContext = Partial<Record<MergeTag, string>>;

export function renderMergeTags(template: string, ctx: MergeContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if ((MERGE_TAGS as readonly string[]).includes(key)) {
      return ctx[key as MergeTag] ?? "";
    }
    return `{{${key}}}`;
  });
}

export { MERGE_TAGS };
