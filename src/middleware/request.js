import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(0)}ms id=${req.id}`;
    if (res.statusCode >= 500) {
      console.error(line);
    } else if (process.env.NODE_ENV !== 'test') {
      console.log(line);
    }
  });

  next();
}
