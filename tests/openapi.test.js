import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApiDocument, openapiDocument } from '../src/docs/openapi.js';

function resolveRef(document, ref) {
  if (!ref.startsWith('#/')) {
    return null;
  }

  const parts = ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));

  let current = document;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) {
      return null;
    }
  }
  return current;
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function operations(document) {
  const list = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        list.push({ path, method, operation });
      }
    }
  }
  return list;
}

test('openapi document has the required top-level sections', () => {
  assert.equal(openapiDocument.openapi, '3.0.3');
  assert.ok(openapiDocument.info.title);
  assert.ok(openapiDocument.info.version);
  assert.ok(Array.isArray(openapiDocument.servers));
  assert.ok(Array.isArray(openapiDocument.tags));
  assert.ok(openapiDocument.components.securitySchemes.bearerAuth);
  assert.equal(openapiDocument.components.securitySchemes.bearerAuth.scheme, 'bearer');
});

test('server prefix is configurable', () => {
  const custom = buildOpenApiDocument({ prefix: '/custom/v1', localUrl: 'http://localhost:9999/custom/v1' });
  assert.equal(custom.servers[0].url, '/custom/v1');
  assert.equal(custom.servers[1].url, 'http://localhost:9999/custom/v1');
});

test('every operation has a unique operationId, tags, and responses', () => {
  const ids = new Set();
  const items = operations(openapiDocument);

  assert.ok(items.length >= 30);
  for (const { method, path, operation } of items) {
    assert.ok(operation.operationId, `${method.toUpperCase()} ${path} is missing operationId`);
    assert.ok(!ids.has(operation.operationId), `duplicate operationId: ${operation.operationId}`);
    ids.add(operation.operationId);
    assert.ok(Array.isArray(operation.tags) && operation.tags.length > 0, `${operation.operationId} is missing tags`);
    assert.ok(operation.responses && Object.keys(operation.responses).length > 0, `${operation.operationId} is missing responses`);
  }
});

test('all internal references resolve', () => {
  walk(openapiDocument, (node) => {
    if (typeof node.$ref === 'string') {
      assert.ok(resolveRef(openapiDocument, node.$ref), `unresolved ref: ${node.$ref}`);
    }
  });
});

test('core API paths are documented', () => {
  const required = [
    '/health/live',
    '/health/ready',
    '/trades',
    '/auth/signup',
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/me',
    '/users/me',
    '/workers/nearby',
    '/workers/me',
    '/workers/me/availability',
    '/workers/me/services',
    '/workers/me/services/{serviceId}',
    '/workers/me/portfolio',
    '/workers/me/portfolio/{itemId}',
    '/workers/me/verification',
    '/workers/{id}',
    '/bookings',
    '/bookings/{id}',
    '/bookings/{id}/accept',
    '/bookings/{id}/decline',
    '/bookings/{id}/cancel',
    '/bookings/{id}/status',
    '/bookings/{id}/review',
    '/admin/overview',
    '/admin/verifications',
    '/admin/workers/{workerId}/verification',
    '/admin/users',
    '/admin/users/{id}/status',
    '/admin/bookings',
  ];

  for (const path of required) {
    assert.ok(openapiDocument.paths[path], `missing path: ${path}`);
  }
});

test('protected endpoints use bearer auth', () => {
  const protectedOperations = [
    ['post', '/auth/logout'],
    ['get', '/auth/me'],
    ['get', '/users/me'],
    ['get', '/workers/me'],
    ['post', '/bookings'],
    ['post', '/bookings/{id}/accept'],
    ['get', '/admin/overview'],
  ];

  for (const [method, path] of protectedOperations) {
    const operation = openapiDocument.paths[path][method];
    assert.ok(operation.security?.some((item) => item.bearerAuth), `${method.toUpperCase()} ${path} is missing bearer auth`);
  }
});
