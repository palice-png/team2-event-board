import type { ICommentRecord, ICommentRepository } from "./CommentRepository";

const commentStore = new Map<string, ICommentRecord>();

class InMemoryCommentRepository implements ICommentRepository {
  async create(comment: ICommentRecord): Promise<void> {
    commentStore.set(comment.id, comment);
  }

  async getById(id: string): Promise<ICommentRecord | null> {
    return commentStore.get(id) ?? null;
  }

  async listByEventId(eventId: string): Promise<ICommentRecord[]>{
    return [...commentStore.values()].filter(
      (comment) => comment.eventId === eventId,
    );
  }

  async delete(id: string): Promise<void>{
    commentStore.delete(id);
  }
}

export function CreateInMemoryCommentRepository(): ICommentRepository {
  return new InMemoryCommentRepository();
}