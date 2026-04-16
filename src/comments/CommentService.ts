import { Ok, Err, type Result } from "../lib/result";
import type { ICommentRepository, Comment } from "./CommentRepository";

// TODO: validate event exists once EventRepository is integrated
export type CommentSummary = Comment;

export type CommentError =
  | { name: "ValidationError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "EventNotFoundError"; message: string }
  | { name: "CommentNotFoundError"; message: string };

export class CommentService {
    createComment(
        eventId: string,
        content: string,
        actingUserId: string,
        actingUserRole: string
      ): Result<CommentSummary, CommentError> {
    
    
        if (!content?.trim()) {
            return Err<CommentError>({
                name: "ValidationError",
                message: "Comment cannot be empty",
              });
        }
    
      
        if (!actingUserId) {
            return Err<CommentError>({
                name: "UnauthorizedError",
                message: "User must be logged in",
              });
        }
    
        const comment: Comment = {
          id: crypto.randomUUID(),
          eventId,
          userId: actingUserId,
          content,
          createdAt: new Date().toISOString(),
        };
    
        this.repo.create(comment);
    
        return Ok(comment);
      }
}