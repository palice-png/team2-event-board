import type { ICommentRecord, ICommentRepository } from "./CommentRepository";

const commentStore = new Map<string, ICommentRecord>();

class InMemoryCommentRepository implements ICommentRepository {
  create(comment: ICommentRecord): void {
    commentStore.set(comment.id, comment);
  }

  getById(id: string): ICommentRecord | null {
    return commentStore.get(id) ?? null;
  }

  listByEventId(eventId: string): ICommentRecord[] {
    return [...commentStore.values()].filter(
      (comment) => comment.eventId === eventId,
    );
  }

  delete(id: string): void {
    commentStore.delete(id);
  }
}

export function CreateInMemoryCommentRepository(): ICommentRepository {
  return new InMemoryCommentRepository();
}