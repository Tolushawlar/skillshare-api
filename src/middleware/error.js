import { ZodError } from 'zod';
import { ApiError } from '../utils/errors.js';

export function notFound(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist.`,
      request_id: req.id,
    },
  });
}

function zodDetails(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request body or query is invalid.',
        details: zodDetails(error),
        request_id: req.id,
      },
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
        request_id: req.id,
      },
    });
  }

  if (error?.code === '23505') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'A record with those details already exists.',
        request_id: req.id,
      },
    });
  }

  if (error?.code === '23P01') {
    return res.status(409).json({
      error: {
        code: 'BOOKING_SLOT_UNAVAILABLE',
        message: 'This worker already has a job at the selected time.',
        request_id: req.id,
      },
    });
  }

  if (error?.code === '23503') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'A referenced record does not exist.',
        request_id: req.id,
      },
    });
  }

  if (error?.code === '22P02') {
    return res.status(400).json({
      error: {
        code: 'INVALID_IDENTIFIER',
        message: 'One of the identifiers in the request is not valid.',
        request_id: req.id,
      },
    });
  }

  if (error?.code === '23514') {
    return res.status(400).json({
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'One or more values are outside the allowed range.',
        request_id: req.id,
      },
    });
  }

  console.error(`[${req.id}] Unhandled error`, error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      request_id: req.id,
    },
  });
}
