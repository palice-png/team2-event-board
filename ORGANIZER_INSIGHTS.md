# Organizer Insights

## What it does

Organizer Insights is our Demo Day optional feature for the Local Event Board app.

It extends the existing organizer dashboard by adding:

1. An **Organizer Insights** summary panel
2. Smart insight labels on each event row

The summary panel shows:

- Total Events
- Published Events
- Draft Events
- Cancelled/Past Events
- Total Attendees
- Low Engagement
- Almost Full

Each event row also displays an insight label such as:

- Low Engagement
- Almost Full
- Ready to Review
- Past
- Cancelled
- On Track

## Why we chose it

The original organizer dashboard shows useful event information, but organizers still need to manually scan each event to figure out which ones need action.

Organizer Insights helps organizers quickly understand the condition of their events.

For example:

- A published event with 0 attendees is marked as **Low Engagement**
- An event close to capacity is marked as **Almost Full**
- A draft event is marked as **Ready to Review**
- A normal published event is marked as **On Track**

## How it works

The feature uses existing dashboard data that is already loaded by `EventService.getOrganizerDashboard()`.

No new database tables, routes, controller methods, or repository methods were added.

The service computes:

- the dashboard insights summary
- the per-event `insightLabel`

The EJS views then render the prepared data.

## Files changed

- `src/event/EventService.ts`
- `src/views/events/organizer-dashboard.ejs`
- `src/views/events/partials/dashboard-row.ejs`

## Implementation details

`EventService.getOrganizerDashboard()` now attaches an `insightLabel` to each dashboard event using this rule order:

1. **Cancelled** if the event status is cancelled
2. **Past** if the event status is past
3. **Ready to Review** if the event is a draft
4. **Low Engagement** if the event is published and has 0 attendees
5. **Almost Full** if the event has capacity and attendance is at least 80%
6. **On Track** otherwise

The dashboard also includes an `insights` object with summary counts.

## What we preserved

This feature does not change:

- existing dashboard grouping
- existing role-based access rules
- existing publish/cancel behavior
- existing HTMX update behavior
- the database schema

## Challenges

The main challenge was adding useful organizer-facing insight without changing the existing architecture or breaking the dashboard's HTMX publish/cancel updates.
