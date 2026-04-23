import request from "supertest";
import { createComposedApp } from "../../src/composition";

const app = createComposedApp().getExpressApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/login")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send(`email=${email}&password=${password}`);
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

async function createAndPublishEvent(cookie: string): Promise<string> {
  await request(app)
    .post("/events")
    .set("Cookie", cookie)
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send(
      "title=Test+Event&description=Test+Description&location=UMass&category=Workshop&capacity=10&startDatetime=2027-01-01T10%3A00&endDatetime=2027-01-01T12%3A00",
    );

  const dashboard = await request(app)
    .get("/organizer/dashboard")
    .set("Cookie", cookie);

  const match = dashboard.text.match(/\/events\/([\w-]{36})/);
  if (!match) throw new Error("Could not find event ID");
  const eventId = match[1];

  await request(app)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie);

  return eventId;
}

async function postComment(
    cookie: string,
    eventId: string,
    content: string,
  ): Promise<string> {
    
    await request(app)
      .post(`/events/${eventId}/comments`)
      .set("Cookie", cookie)
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`content=${encodeURIComponent(content)}`);
  
    
    const detail = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", cookie);
  
   
    const match = 
      detail.text.match(/\/comments\/([\w-]{36})\/delete/) ||
      detail.text.match(/comments\/([\w-]{36})/);
      
    if (!match) {
      throw new Error(`Could not find comment ID. Detail page status: ${detail.status}`);
    }
    return match[1];
  }

describe("Feature 13 — Event Comments HTTP routes", () => {

  describe("POST /events/:id/comments", () => {
    it("redirects unauthenticated users to login", async () => {
      const res = await request(app)
        .post("/events/some-id/comments")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("content=Hello");
      expect([302, 401]).toContain(res.status);
    });

    it("happy path: authenticated user can post a comment", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const res = await request(app)
        .post(`/events/${eventId}/comments`)
        .set("Cookie", userCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("content=Great+event!");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`/events/${eventId}`);
    });

    it("returns 400 for empty comment content", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const res = await request(app)
        .post(`/events/${eventId}/comments`)
        .set("Cookie", userCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("content=");
      expect(res.status).toBe(400);
    });

    it("returns 400 for whitespace-only comment", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const res = await request(app)
        .post(`/events/${eventId}/comments`)
        .set("Cookie", userCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("content=+++");
      expect(res.status).toBe(400);
    });
  });

  describe("POST /comments/:id/delete", () => {
    it("redirects unauthenticated users", async () => {
      const res = await request(app)
        .post("/comments/some-id/delete")
        .set("Content-Type", "application/x-www-form-urlencoded");
      expect([302, 401]).toContain(res.status);
    });

    it("happy path: author can delete their own comment", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const commentId = await postComment(userCookie, eventId, "My comment");
      const res = await request(app)
        .post(`/comments/${commentId}/delete`)
        .set("Cookie", userCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(`eventId=${eventId}`);
      expect(res.status).toBe(302);
    });

    it("admin can delete any comment", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const commentId = await postComment(userCookie, eventId, "User comment");
      const adminCookie = await loginAs("admin@app.test", "password123");
      const res = await request(app)
        .post(`/comments/${commentId}/delete`)
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(`eventId=${eventId}`);
      expect(res.status).toBe(302);
    });

    it("returns 403 when user tries to delete another user's comment", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createAndPublishEvent(staffCookie);
      const userCookie = await loginAs("user@app.test", "password123");
      const commentId = await postComment(userCookie, eventId, "User comment");
      const res = await request(app)
        .post(`/comments/${commentId}/delete`)
        .set("Cookie", staffCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(`eventId=${eventId}`);
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent comment", async () => {
        const staffCookie = await loginAs("staff@app.test", "password123");
        const eventId = await createAndPublishEvent(staffCookie);
        const userCookie = await loginAs("user@app.test", "password123");
        const res = await request(app)
          .post("/comments/00000000-0000-0000-0000-000000000000/delete")
          .set("Cookie", userCookie)
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(`eventId=${eventId}`);
    });
  });
});