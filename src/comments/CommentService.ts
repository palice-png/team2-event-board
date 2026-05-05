import { Ok, Err, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { ICommentRecord, ICommentRepository } from "./CommentRepository";
import type { IUserRepository } from "../auth/UserRepository";

export type CommentSummary = ICommentRecord;

export type CommentError =
  | { name: "ValidationError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "CommentNotFoundError"; message: string };

export interface ICommentService {
  createComment(
    eventId: string,
    content: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<CommentSummary, CommentError>>;

  deleteComment(
    commentId: string,
    actingUserId: string,
    actingUserRole: UserRole,
    eventOrganizerId: string,
  ): Promise<Result<void, CommentError>>;

  listCommentsByEventId(
    eventId: string,
  ): Promise<Result<CommentSummary[], CommentError>>;
}

class CommentService implements ICommentService {
  constructor(
    private readonly repo: ICommentRepository,
    private readonly users: IUserRepository,
  ) {}
  

  async createComment(
    eventId: string,
    content: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<CommentSummary, CommentError>> {
    if (!actingUserId) {
      return Err({ name: "UnauthorizedError" as const, message: "User must be logged in." });
    }

    if (!content?.trim()) {
      return Err({ name: "ValidationError" as const, message: "Comment cannot be empty." });
    }

    const comment: ICommentRecord = {
      id: crypto.randomUUID(),
      eventId,
      userId: actingUserId,
      body: content.trim(),
      createdAt: new Date().toISOString(),
    };

    await this.repo.create(comment);

    return Ok(comment);
  }

  async deleteComment(
    commentId: string,
    actingUserId: string,
    actingUserRole: UserRole,
    eventOrganizerId: string,
  ): Promise<Result<void, CommentError>> {
    const comment = await this.repo.getById(commentId);

    if (!comment) {
      return Err({ name: "CommentNotFoundError" as const, message: "Comment not found." });
    }

    const isOwner = comment.userId === actingUserId;
    const isAdmin = actingUserRole === "admin";
    const isOrganizer = actingUserId === eventOrganizerId;

    if (!isOwner && !isAdmin) {
      return Err({ name: "UnauthorizedError" as const, message: "Not allowed to delete this comment." });
    }

    await this.repo.delete(commentId);

    return Ok(undefined);
  }

  async listCommentsByEventId(
    eventId: string,
  ): Promise<Result<CommentSummary[], CommentError>> {
    const comments = await this.repo.listByEventId(eventId);
    
    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const userResult = await this.users.findById(comment.userId);
        const displayName = userResult.ok && userResult.value
          ? userResult.value.displayName
          : comment.userId;
        return { ...comment, displayName };
      }),
    );

    return Ok(enriched);
  
  }
}

export function CreateCommentService(
  repo: ICommentRepository,
  users: IUserRepository,
): ICommentService {
  return new CommentService(repo, users);
}