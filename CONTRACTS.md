# CONTRACTS.md

## Feature 1 — Event Creation

### EventService.createEvent
- Owner: Jongchan
- Signature: `createEvent(eventInput, actingUserId, actingUserRole): Result<EventSummary, CreateEventError>`
- Success: returns newly created event with status `draft`
- Errors: `ValidationError`, `UnauthorizedError`

---

## Feature 2 — Event Detail Page

### EventService.getEventById
- Owner: Jongchan
- Signature: `getEventById(eventId, actingUserId, actingUserRole): Result<EventSummary, GetEventError>`
- Success: returns event details if visible to the acting user
- Errors: `EventNotFoundError`, `UnauthorizedError`

---

## Feature 3 — Event Editing

### EventService.updateEvent
- Owner: Josie
- Signature: `updateEvent(eventId, eventInput, actingUserId, actingUserRole): Result<EventSummary, UpdateEventError>`
- Success: returns updated event
- Errors: `EventNotFoundError`, `UnauthorizedError`, `InvalidEventStateError`, `ValidationError`

### EventService.validateEventInput
- Owner: Josie
- Signature: `validateEventInput(eventInput): Result<EventInput, ValidationError>`
- Success: returns validated event input
- Errors: `ValidationError`

---

## Feature 4 — RSVP Toggle

### RsvpService.toggleRsvp
- Owner: Harini
- Signature: `toggleRsvp(eventId, actingUserId, actingUserRole): Result<RsvpToggleResult, RsvpError>`
- Success: returns updated RSVP state for the acting user
- Errors: `EventNotFoundError`, `UnauthorizedError`, `InvalidEventStateError`

---

## Feature 5 — Event Publishing and Cancellation

### EventService.publishEvent
- Owner: Jigeon
- Signature: `publishEvent(eventId, actingUserId, actingUserRole): Result<EventSummary, PublishEventError>`
- Success: returns event with status `published`
- Errors: `EventNotFoundError`, `UnauthorizedError`, `InvalidEventStateError`

### EventService.cancelEvent
- Owner: Jigeon
- Signature: `cancelEvent(eventId, actingUserId, actingUserRole): Result<EventSummary, CancelEventError>`
- Success: returns event with status `cancelled`
- Errors: `EventNotFoundError`, `UnauthorizedError`, `InvalidEventStateError`

---

## Feature 7 — My RSVPs Dashboard

### RsvpService.getMyRsvps
- Owner: Alice
- Signature: `getMyRsvps(actingUserId, actingUserRole): Result<MyRsvpsView, MyRsvpsError>`
- Success: returns the acting user's RSVPs grouped and sorted for the dashboard
- Errors: `UnauthorizedError`

---

## Feature 8 — Organizer Event Dashboard

### EventService.getOrganizerDashboard
- Owner: Jigeon
- Signature: `getOrganizerDashboard(actingUserId, actingUserRole): Result<OrganizerDashboardView, DashboardError>`
- Success: returns dashboard data grouped into `published`, `draft`, and `cancelledOrPast`
- Errors: `UnauthorizedError`

---

## Feature 9 — Waitlist Promotion

### RsvpService.cancelRsvpAndPromoteWaitlist
- Owner: Harini
- Signature: `cancelRsvpAndPromoteWaitlist(eventId, actingUserId, actingUserRole): Result<WaitlistPromotionResult, RsvpError>`
- Success: returns cancelled RSVP result and promoted waitlist result if applicable
- Errors: `EventNotFoundError`, `UnauthorizedError`, `InvalidEventStateError`

### RsvpService.getWaitlistPosition
- Owner: Harini
- Signature: `getWaitlistPosition(eventId, actingUserId): Result<number | null, WaitlistError>`
- Success: returns the acting user's waitlist position, or `null` if not waitlisted
- Errors: `EventNotFoundError`

---

## Feature 11 — Past Event Archiving

### EventService.transitionExpiredEvents
- Owner: Alice
- Signature: `transitionExpiredEvents(now): Result<number, ArchiveError>`
- Success: returns the number of events moved to status `past`
- Errors: `UnexpectedDependencyError`

### EventService.getArchivedEvents
- Owner: Alice
- Signature: `getArchivedEvents(category): Result<EventSummary[], ArchiveError>`
- Success: returns past events in reverse chronological order
- Errors: `InvalidFilterError`

---

## Feature 13 — Event Comments

### CommentService.createComment
- Owner: Josie
- Signature: `createComment(eventId, content, actingUserId, actingUserRole): Result<CommentSummary, CommentError>`
- Success: returns newly created comment
- Errors: `EventNotFoundError`, `ValidationError`, `UnauthorizedError`

### CommentService.deleteComment
- Owner: Josie
- Signature: `deleteComment(commentId, actingUserId, actingUserRole): Result<void, CommentError>`
- Success: returns success when comment deletion is completed
- Errors: `CommentNotFoundError`, `UnauthorizedError`

---

## Shared Notes

- `staff` corresponds to organizer
- `user` corresponds to member
- All service methods return `Result<T, E>`
- Success shape: `{ ok: true, value: T }`
- Failure shape: `{ ok: false, value: E }`