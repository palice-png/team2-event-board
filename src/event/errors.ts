export type ValidationError = {
  name: "ValidationError";
  message: string;
};

export type UnauthorizedError = {
  name: "UnauthorizedError";
  message: string;
};

export type UnexpectedDependencyError = {
  name: "UnexpectedDependencyError";
  message: string;
};

export type EventNotFoundError = {
  name: "EventNotFoundError";
  message: string;
};

export type CreateEventError =
  | ValidationError
  | UnauthorizedError
  | UnexpectedDependencyError;

export type GetEventError =
  | EventNotFoundError
  | UnauthorizedError
  | UnexpectedDependencyError;

export const ValidationError = (message: string): ValidationError => ({
  name: "ValidationError",
  message,
});

export const UnauthorizedError = (message: string): UnauthorizedError => ({
  name: "UnauthorizedError",
  message,
});

export const UnexpectedDependencyError = (
  message: string,
): UnexpectedDependencyError => ({
  name: "UnexpectedDependencyError",
  message,
});

export const EventNotFoundError = (message: string): EventNotFoundError => ({
  name: "EventNotFoundError",
  message,
});