import { PrismaClient } from "@prisma/client";
import { Err, Ok } from "../lib/result";
import type { ICommentRecord, ICommentRepository } from "./CommentRepository";

function isRecordNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2025"
  );
}

class PrismaCommentRepository implements ICommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(comment: ICommentRecord): Promise<void> {
    await this.prisma.comment.create({
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
    try {
      const comment = await this.prisma.comment.findUnique({ where: { id } });
      if (!comment) return null;
      return {
        id: comment.id,
        eventId: comment.eventId,
        userId: comment.userId,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async listByEventId(eventId: string): Promise<ICommentRecord[]> {
    try {
      const comments = await this.prisma.comment.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });
      return comments.map((c) => ({
        id: c.id,
        eventId: c.eventId,
        userId: c.userId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.comment.delete({ where: { id } });
    } catch (e) {
      if (!isRecordNotFound(e)) throw e;
    }
  }
}

export function CreatePrismaCommentRepository(
  prisma: PrismaClient,
): ICommentRepository {
  return new PrismaCommentRepository(prisma);
}