import type { Comment as PrismaComment } from "@prisma/client";
import type { ICommentRecord, ICommentRepository } from "./CommentRepository";

class PrismaCommentRepository implements ICommentRepository {
  async create(comment: ICommentRecord): Promise<void> {
    await prisma.comment.create({
      data: {
        id: comment.id,
        eventId: comment.eventId,
        userId: comment.userId,
        body: comment.body,
        createdAt: new Date(comment.createdAt),
      },
    });
  }
  async getById(id: string): Promise<ICommentRecord | null> {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return null;
    return {
      id: comment.id,
      eventId: comment.eventId,
      userId: comment.userId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }
  
  async listByEventId(eventId: string): Promise<ICommentRecord[]> {
    const comments = await prisma.comment.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
    return comments.map((c: PrismaComment) => ({
      id: c.id,
      eventId: c.eventId,
      userId: c.userId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    }));
  }
  
  async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }
}
  
  export function CreatePrismaCommentRepository(): ICommentRepository {
    return new PrismaCommentRepository();
  }
