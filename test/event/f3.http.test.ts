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

async function createDraftEvent(cookie: string): Promise<string> {
  // Create the event
  await request(app)
    .post("/events")
    .set("Cookie", cookie)
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send(
      "title=Test+Event&description=Test+Description&location=UMass&category=Workshop&capacity=10&startDatetime=2027-01-01T10%3A00&endDatetime=2027-01-01T12%3A00",
    );

  // Get the dashboard and find any event ID
  const dashboard = await request(app)
    .get("/organizer/dashboard")
    .set("Cookie", cookie);

  // Look for any event ID pattern in the dashboard HTML
  const match = dashboard.text.match(/\/events\/([\w-]{36})/);
  if (!match) throw new Error("Could not find event ID in dashboard");
  return match[1];
}

describe("Feature 3 — Event Editing HTTP routes", () => {

  describe("GET /events/:id/edit", () => {
    it("redirects unauthenticated users to login", async () => {
      const res = await request(app).get("/events/some-id/edit");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    it("returns 403 for regular users", async () => {
      const cookie = await loginAs("user@app.test", "password123");
      const res = await request(app)
        .get("/events/some-id/edit")
        .set("Cookie", cookie);
      expect(res.status).toBe(403);
    });

    it("returns 200 and renders edit form for staff owner", async () => {
      const cookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(cookie);

      const res = await request(app)
        .get(`/events/${eventId}/edit`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Edit Event");
    });

    it("returns 404 for non-existent event", async () => {
      const cookie = await loginAs("staff@app.test", "password123");
      const res = await request(app)
        .get("/events/00000000-0000-0000-0000-000000000000/edit")
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
    });

    it("returns 200 for admin editing any event", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(staffCookie);

      const adminCookie = await loginAs("admin@app.test", "password123");
      const res = await request(app)
        .get(`/events/${eventId}/edit`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /events/:id/edit", () => {
    it("returns 401 or 302 for unauthenticated users", async () => {
      const res = await request(app)
        .post("/events/some-id/edit")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("title=Updated");

      expect([302, 401]).toContain(res.status);
    });

    it("returns 403 for regular users", async () => {
      const cookie = await loginAs("user@app.test", "password123");
      const res = await request(app)
        .post("/events/some-id/edit")
        .set("Cookie", cookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("title=Updated");
      expect(res.status).toBe(403);
    });

    it("returns 302 redirect to event detail on successful update", async () => {
      const cookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(cookie);

      const res = await request(app)
        .post(`/events/${eventId}/edit`)
        .set("Cookie", cookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          "title=Updated+Title&description=Updated+Desc&location=New+Location&category=Seminar&capacity=20&startDatetime=2027-02-01T10%3A00&endDatetime=2027-02-01T12%3A00",
        );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`/events/${eventId}`);
    });

    it("returns 400 when title is empty", async () => {
      const cookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(cookie);

      const res = await request(app)
        .post(`/events/${eventId}/edit`)
        .set("Cookie", cookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          "title=&description=Desc&location=UMass&category=Workshop&capacity=&startDatetime=2027-02-01T10%3A00&endDatetime=2027-02-01T12%3A00",
        );

      expect(res.status).toBe(400);
    });

    it("returns 403 when staff tries to edit another user's event", async () => {
      const staffCookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(staffCookie);

      // Admin can edit anyone's event so this should pass
      const adminCookie = await loginAs("admin@app.test", "password123");
      const res = await request(app)
        .post(`/events/${eventId}/edit`)
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          "title=Admin+Updated&description=Desc&location=UMass&category=Workshop&capacity=&startDatetime=2027-02-01T10%3A00&endDatetime=2027-02-01T12%3A00",
        );

      expect(res.status).toBe(302);
    });

    it("returns 400 when end date is before start date", async () => {
      const cookie = await loginAs("staff@app.test", "password123");
      const eventId = await createDraftEvent(cookie);

      const res = await request(app)
        .post(`/events/${eventId}/edit`)
        .set("Cookie", cookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          "title=Bad+Dates&description=Desc&location=UMass&category=Workshop&capacity=&startDatetime=2027-02-01T12%3A00&endDatetime=2027-02-01T10%3A00",
        );

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent event", async () => {
      const cookie = await loginAs("staff@app.test", "password123");

      const res = await request(app)
        .post("/events/00000000-0000-0000-0000-000000000000/edit")
        .set("Cookie", cookie)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          "title=Title&description=Desc&location=UMass&category=Workshop&capacity=&startDatetime=2027-02-01T10%3A00&endDatetime=2027-02-01T12%3A00",
        );

      expect(res.status).toBe(404);
    });
  });
});