export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super("NOT_FOUND", `${resource}${id ? ` ${id}` : ""} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INFRASTRUCTURE_ERROR", message, 502, details);
    this.name = "InfrastructureError";
  }
}
