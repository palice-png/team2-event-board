import { CreateCommentService } from "../../src/comments/CommentService";
import { CreateInMemoryCommentRepository } from "../../src/comments/InMemoryCommentRepository";
import type { IUserRepository } from "../../src/auth/UserRepository";
import type { IUserRecord } from "../../src/auth/User";

function makeMockUserRepository(): IUserRepository {
  const users = new Map<string, IUserRecord>();
  return {
    async findById(id) {
      const user = users.get(id);
      return { ok: true, value: user ?? null };
    },
    async findByEmail() { return { ok: true, value: null }; },
    async listUsers() { return { ok: true, value: [] }; },
    async createUser(user) { users.set(user.id, user); return { ok: true, value: user }; },
    async deleteUser() { return { ok: true, value: true }; },
  };
}

function makeService() {
  const repo = CreateInMemoryCommentRepository();
  const users = makeMockUserRepository();
  const service = CreateCommentService(repo, users);
  return { repo, service };
}

describe("CommentService — Feature 13", () => {

  describe("createComment", () => {
    it("happy path: creates a comment and returns it", async () => {
      const { service } = makeService();
      const result = await service.createComment("event-1", "Great event!", "user-1", "user");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.body).toBe("Great event!");
        expect(result.value.eventId).toBe("event-1");
        expect(result.value.userId).toBe("user-1");
      }
    });

    it("trims whitespace from comment content", async () => {
      const { service } = makeService();
      const result = await service.createComment("event-1", "  Great event!  ", "user-1", "user");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.body).toBe("Great event!");
      }
    });

    it("returns ValidationError for empty content", async () => {
      const { service } = makeService();
      const result = await service.createComment("event-1", "", "user-1", "user");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("ValidationError");
      }
    });

    it("returns ValidationError for whitespace-only content", async () => {
      const { service } = makeService();
      const result = await service.createComment("event-1", "   ", "user-1", "user");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("ValidationError");
      }
    });

    it("returns UnauthorizedError when userId is empty", async () => {
      const { service } = makeService();
      const result = await service.createComment("event-1", "Great event!", "", "user");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnauthorizedError");
      }
    });
  });

  describe("deleteComment", () => {
    it("happy path: author can delete their own comment", async () => {
      const { service } = makeService();
      const created = await service.createComment("event-1", "My comment", "user-1", "user");
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const result = await service.deleteComment(created.value.id, "user-1", "user", "");
      expect(result.ok).toBe(true);
    });
    it("organizer can delete any comment on their event", async () => {
      const { service } = makeService();
      const created = await service.createComment("event-1", "Some comment", "user-1", "user");
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const result = await service.deleteComment(created.value.id, "organizer-1", "staff", "organizer-1");
      expect(result.ok).toBe(true);
    });

    it("admin can delete any comment", async () => {
      const { service } = makeService();
      const created = await service.createComment("event-1", "Some comment", "user-1", "user");
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const result = await service.deleteComment(created.value.id, "user-admin", "admin", "");
      expect(result.ok).toBe(true);
    });

    it("returns CommentNotFoundError for non-existent comment", async () => {
      const { service } = makeService();
      const result = await service.deleteComment("non-existent-id", "user-1", "user", "");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("CommentNotFoundError");
      }
    });

    it("returns UnauthorizedError when user tries to delete another user's comment", async () => {
      const { service } = makeService();
      const created = await service.createComment("event-1", "User 1 comment", "user-1", "user");
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const result = await service.deleteComment(created.value.id, "user-2", "user", "");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnauthorizedError");
      }
    });
  });

  describe("listCommentsByEventId", () => {
    it("returns empty list when no comments exist for a new event", async () => {
      const { service } = makeService();
      const result = await service.listCommentsByEventId("event-never-used");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("returns only comments for the specified event", async () => {
      const { service } = makeService();
      const uniqueEventId = `event-${crypto.randomUUID()}`;
      await service.createComment(uniqueEventId, "Comment on my event", "user-1", "user");
      await service.createComment("event-other", "Comment on other event", "user-1", "user");
      const result = await service.listCommentsByEventId(uniqueEventId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].eventId).toBe(uniqueEventId);
      }
    });

    it("comment is no longer returned after deletion", async () => {
      const { service } = makeService();
      const uniqueEventId = `event-${crypto.randomUUID()}`;
      const created = await service.createComment(uniqueEventId, "To be deleted", "user-1", "user");
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      await service.deleteComment(created.value.id, "user-1", "user", "");
      const result = await service.listCommentsByEventId(uniqueEventId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  });
});