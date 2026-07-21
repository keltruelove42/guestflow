import { renderMergeTags, firstName } from "../messaging/render";

export function previewEmailBody(
  template: string,
  opts: { name: string; property: string; hostName?: string },
): string {
  return renderMergeTags(template, {
    first_name: firstName(opts.name),
    property: opts.property,
    host_name: opts.hostName ?? "Taylor",
  });
}
