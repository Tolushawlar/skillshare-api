export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details) {
  return new ApiError(400, code, message, details);
}

export function unauthorized(message = 'Authentication required.') {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have access to this resource.') {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Resource not found.') {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function conflict(code, message, details) {
  return new ApiError(409, code, message, details);
}

export function assert(condition, factory) {
  if (!condition) {
    throw factory();
  }
}
