import type { PublicProfile } from "./publicDecks.ts";

export const COMMENT_LIMIT = 2000;
export type DeckComment = {
  id: string;
  deckId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: PublicProfile | null;
};

export function commentBody(value: string): string {
  const body = value.trim();
  if (!body) throw new Error("Write a comment before posting.");
  if (body.length > COMMENT_LIMIT) throw new Error(`Comments can contain up to ${COMMENT_LIMIT} characters.`);
  return body;
}

// Flatten threads for accessible markup and cap visual indentation in the UI.
// Missing parents (e.g. between paginated loads) never hide a comment.
export function commentThreads(comments: DeckComment[]): { comment: DeckComment; depth: number }[] {
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const children = new Map<string | null, DeckComment[]>();
  for (const comment of byId.values()) {
    const parent = comment.parentId && byId.has(comment.parentId) ? comment.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), comment]);
  }
  for (const group of children.values()) group.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const result: { comment: DeckComment; depth: number }[] = [];
  const visited = new Set<string>();
  const stack = [...(children.get(null) ?? [])].reverse().map(comment => ({ comment, depth: 0 }));
  while (stack.length) {
    const entry = stack.pop()!;
    if (visited.has(entry.comment.id)) continue;
    visited.add(entry.comment.id);
    result.push(entry);
    for (const comment of [...(children.get(entry.comment.id) ?? [])].reverse()) stack.push({ comment, depth: entry.depth + 1 });
  }
  return result;
}
