export type EventError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "InvalidEventStateError"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export type PublishEventError = EventError;
export type CancelEventError = EventError;

export const EventNotFoundError = (message: string): EventError => ({
  name: "EventNotFoundError",
  message,
});

export const UnauthorizedError = (message: string): EventError => ({
  name: "UnauthorizedError",
  message,
});

export const InvalidEventStateError = (message: string): EventError => ({
  name: "InvalidEventStateError",
  message,
});

export const UnexpectedDependencyError = (message: string): EventError => ({
  name: "UnexpectedDependencyError",
  message,
});
