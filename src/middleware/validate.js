export function validate(schema, source = 'body') {
  return function validateRequest(req, _res, next) {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(parsed.error);
    }
    req[source] = parsed.data;
    return next();
  };
}
