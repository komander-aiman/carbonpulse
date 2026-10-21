import "server-only";

import { loadContext, type ContextBlock } from "@/lib/context";
import { ContextPanel } from "@/components/context-panel";

export async function ContextSection({
  title = "National and local context",
  eyebrow = "Sources",
  compact = false,
}: {
  title?: string;
  eyebrow?: string;
  compact?: boolean;
}) {
  const context: ContextBlock = await loadContext();
  return <ContextPanel block={context} title={title} eyebrow={eyebrow} compact={compact} />;
}
