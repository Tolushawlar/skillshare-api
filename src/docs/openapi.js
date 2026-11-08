const schema = (name) => ({ $ref: `#/components/schemas/${name}` });
const parameter = (name) => ({ $ref: `#/components/parameters/${name}` });
const response = (name) => ({ $ref: `#/components/responses/${name}` });

function jsonBody(requestSchema, example) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: requestSchema,
        ...(example !== undefined ? { example } : {}),
      },
    },
  };
}

function dataResponse(description, dataSchema, example) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['data'],
          properties: { data: dataSchema },
        },
        ...(example !== undefined ? { example: { data: example } } : {}),
      },
    },
  };
}

function listResponse(description, itemSchema, metaSchema) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'array', items: itemSchema },
            ...(metaSchema ? { meta: metaSchema } : {}),
          },
        },
      },
    },
  };
}

const bearer = [{ bearerAuth: [] }];

export function buildOpenApiDocument({ prefix = '/api/v1', localUrl } = {}) {
  const servers = [{ url: prefix, description: 'Current host with the configured API prefix' }];
  if (localUrl) {
    servers.push({ url: localUrl, description: 'Local development server' });
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'SkillLink API',
      version: '0.1.0',
      description: [
        'Location-based skilled-labour marketplace backend.',
        '',
        '## Quick start',
        '1. Start the API with **npm run dev**.',
        '2. Open **/docs** for this Swagger UI.',
        '3. Call **POST /auth/login** or **POST /auth/signup**.',
        '4. Copy **data.session.access_token** from the response.',
        '5. Click **Authorize** below and paste the token.',
        '6. Try any protected endpoint with **Try it out**.',
        '',
        '## Demo accounts',
        'These accounts exist only after running **npm run seed** against a fresh database.',
        '',
        '- Client: **client@skilllink.test** / **password123**',
        '- Worker: **emeka@skilllink.test** / **password123**',
        '- Admin: **admin@skilllink.test** / **admin123**',
        '',
        '## Main booking flow',
        '1. Client logs in and calls **GET /workers/nearby**.',
        '2. Client calls **POST /bookings** with a worker ID and location.',
        '3. Worker logs in and calls **POST /bookings/{id}/accept**.',
        '4. Worker progresses with **/status**: en_route, arrived, in_progress, completed.',
        '5. Client calls **POST /bookings/{id}/review**.',
        '',
        '## Notes',
        '- Money values are in kobo.',
        '- Booking money fields are returned as numbers.',
        '- Send the JWT as a Bearer token in the Authorization header.',
        '- All successful responses use a **data** envelope. Lists also include **meta** when useful.',
        '- Errors use an **error** object with a stable code, message, and request_id.',
      ].join('\n'),
      contact: {
        name: 'SkillLink API',
      },
    },
    servers,
    tags: [
      { name: 'Meta', description: 'API metadata and trade categories.' },
      { name: 'Health', description: 'Liveness and database readiness checks. These also exist outside the API prefix at /health/live and /health/ready.' },
      { name: 'Auth', description: 'Supabase-backed signup, login, refresh, logout, and current-user endpoints.' },
      { name: 'Users', description: 'Current user profile management.' },
      { name: 'Workers', description: 'Worker discovery, profiles, services, portfolio, availability, and verification.' },
      { name: 'Bookings', description: 'Booking creation, lifecycle transitions, and reviews.' },
      { name: 'Admin', description: 'Admin metrics, verification review, user moderation, and booking listing.' },
    ],
    paths: {
      '/': {
        get: {
          tags: ['Meta'],
          operationId: 'getApiMetadata',
          summary: 'API metadata',
          description: 'Returns the API name, version, and documentation path.',
          responses: {
            200: {
              description: 'API metadata.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'SkillLink API' },
                      version: { type: 'string', example: 'v1' },
                      docs: { type: 'string', example: '/docs' },
                    },
                  },
                },
              },
            },
            default: response('InternalError'),
          },
        },
      },

      '/health/live': {
        get: {
          tags: ['Health'],
          operationId: 'healthLive',
          summary: 'Liveness check',
          description: 'Returns 200 without touching the database. Also available at /health/live.',
          responses: {
            200: {
              description: 'Process is alive.',
              content: {
                'application/json': {
                  schema: schema('HealthLive'),
                  example: {
                    status: 'ok',
                    app: 'skilllink-backend',
                    time: '2026-11-05T07:35:13.602Z',
                  },
                },
              },
            },
          },
        },
      },

      '/health/ready': {
        get: {
          tags: ['Health'],
          operationId: 'healthReady',
          summary: 'Readiness check',
          description: 'Runs SELECT 1 against Postgres. Also available at /health/ready.',
          responses: {
            200: {
              description: 'Database is reachable.',
              content: {
                'application/json': {
                  schema: schema('HealthReady'),
                  example: { status: 'ready', database: 'ok' },
                },
              },
            },
            503: {
              description: 'Database is unavailable.',
              content: {
                'application/json': {
                  schema: schema('HealthUnavailable'),
                  example: { status: 'unavailable', database: 'error' },
                },
              },
            },
          },
        },
      },

      '/trades': {
        get: {
          tags: ['Meta'],
          operationId: 'listTrades',
          summary: 'List active trade categories',
          responses: {
            200: listResponse('Active trades ordered by sort order.', schema('Trade')),
            default: response('InternalError'),
          },
        },
      },

      '/auth/signup': {
        post: {
          tags: ['Auth'],
          operationId: 'signup',
          summary: 'Create an account',
          description: 'Creates a Supabase auth user and the matching platform profile. Worker accounts require a trade. This endpoint is rate-limited.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: schema('SignupRequest'),
                examples: {
                  client: {
                    summary: 'Client account',
                    value: {
                      full_name: 'Ada Nwosu',
                      email: 'ada@example.com',
                      password: 'password123',
                      phone: '+2348011111111',
                      role: 'client',
                      location_label: 'Bodija, Ibadan',
                      lat: 7.3775,
                      lng: 3.947,
                    },
                  },
                  worker: {
                    summary: 'Worker account',
                    value: {
                      full_name: 'Emeka Okafor',
                      email: 'emeka@example.com',
                      password: 'password123',
                      phone: '+2348033333333',
                      role: 'worker',
                      location_label: 'Agodi, Ibadan',
                      lat: 7.385,
                      lng: 3.925,
                      trade: 'Mechanic',
                      bio: 'Auto mechanic specialising in diagnostics and roadside repairs.',
                      years_experience: 8,
                      hourly_rate_kobo: 850000,
                      service_radius_m: 15000,
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: dataResponse('Account and profile created.', schema('SignupResult'), {
              user: {
                id: '8fcbdb71-5c93-4c9a-8f97-3f80d3b7b8b4',
                email: 'ada@example.com',
              },
              profile: {
                id: '8fcbdb71-5c93-4c9a-8f97-3f80d3b7b8b4',
                role: 'client',
                full_name: 'Ada Nwosu',
                email: 'ada@example.com',
                status: 'active',
              },
              session: null,
            }),
            400: response('ValidationError'),
            409: response('Conflict'),
            429: response('RateLimited'),
            default: response('InternalError'),
          },
        },
      },

      '/auth/login': {
        post: {
          tags: ['Auth'],
          operationId: 'login',
          summary: 'Email and password login',
          description: 'Returns the Supabase session and the platform profile. Use data.session.access_token as the Bearer token.',
          security: [],
          requestBody: jsonBody(schema('LoginRequest'), {
            email: 'client@skilllink.test',
            password: 'password123',
          }),
          responses: {
            200: dataResponse('Login successful.', schema('LoginResult'), {
              user: {
                id: '8fcbdb71-5c93-4c9a-8f97-3f80d3b7b8b4',
                email: 'client@skilllink.test',
              },
              profile: {
                id: '8fcbdb71-5c93-4c9a-8f97-3f80d3b7b8b4',
                role: 'client',
                full_name: 'Ada Nwosu',
                email: 'client@skilllink.test',
                status: 'active',
              },
              session: {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refresh_token: 'v1.8f3c...',
                token_type: 'bearer',
                expires_in: 3600,
                expires_at: 1762340000,
              },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            429: response('RateLimited'),
            default: response('InternalError'),
          },
        },
      },

      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          operationId: 'refreshSession',
          summary: 'Refresh a Supabase session',
          security: [],
          requestBody: jsonBody({ type: 'object', required: ['refresh_token'], properties: { refresh_token: { type: 'string' } } }, {
            refresh_token: 'v1.8f3c...',
          }),
          responses: {
            200: dataResponse('Refreshed session.', {
              type: 'object',
              properties: {
                session: schema('Session'),
                user: { type: 'object', additionalProperties: true },
              },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            429: response('RateLimited'),
            default: response('InternalError'),
          },
        },
      },

      '/auth/logout': {
        post: {
          tags: ['Auth'],
          operationId: 'logout',
          summary: 'Sign out',
          description: 'Attempts to revoke the current Supabase session. Clients should discard the token regardless.',
          security: bearer,
          responses: {
            204: { description: 'Logged out.' },
            401: response('Unauthorized'),
            default: response('InternalError'),
          },
        },
      },

      '/auth/me': {
        get: {
          tags: ['Auth'],
          operationId: 'getAuthMe',
          summary: 'Current authenticated profile',
          security: bearer,
          responses: {
            200: dataResponse('Current profile.', schema('Profile')),
            401: response('Unauthorized'),
            default: response('InternalError'),
          },
        },
      },

      '/users/me': {
        get: {
          tags: ['Users'],
          operationId: 'getMyProfile',
          summary: 'Get my profile',
          security: bearer,
          responses: {
            200: dataResponse('Current user profile.', schema('Profile')),
            401: response('Unauthorized'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
        patch: {
          tags: ['Users'],
          operationId: 'updateMyProfile',
          summary: 'Update my profile',
          description: 'Updates name, phone, avatar, and location. Provide lat and lng together.',
          security: bearer,
          requestBody: jsonBody(schema('UpdateMeRequest'), {
            full_name: 'Ada Nwosu',
            phone: '+2348011111111',
            location_label: 'Bodija, Ibadan',
            lat: 7.3775,
            lng: 3.947,
          }),
          responses: {
            200: dataResponse('Updated profile.', schema('Profile')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/nearby': {
        get: {
          tags: ['Workers'],
          operationId: 'listNearbyWorkers',
          summary: 'Find nearby workers',
          description: 'Returns verified, active, online workers within the requested radius and their own service radius.',
          parameters: [
            { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 }, example: 7.3775 },
            { name: 'lng', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 }, example: 3.947 },
            { name: 'radius_m', in: 'query', required: false, schema: { type: 'integer', minimum: 1000, maximum: 50000, default: 10000 }, example: 10000 },
            { name: 'trade', in: 'query', required: false, schema: { type: 'string', maxLength: 80 }, example: 'Mechanic' },
            { name: 'min_rating', in: 'query', required: false, schema: { type: 'number', minimum: 0, maximum: 5 }, example: 4 },
            { name: 'sort', in: 'query', required: false, schema: schema('NearbySort'), example: 'nearest' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, example: 20 },
          ],
          responses: {
            200: listResponse('Nearby workers ordered by the selected sort.', schema('NearbyWorker'), {
              type: 'object',
              properties: { count: { type: 'integer', example: 2 } },
            }),
            400: response('ValidationError'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me': {
        get: {
          tags: ['Workers'],
          operationId: 'getMyWorkerProfile',
          summary: 'Get my worker profile',
          security: bearer,
          responses: {
            200: dataResponse('Worker profile with services, portfolio, and latest verification.', schema('WorkerProfile')),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
        patch: {
          tags: ['Workers'],
          operationId: 'updateMyWorkerProfile',
          summary: 'Update my worker profile',
          security: bearer,
          requestBody: jsonBody(schema('UpdateWorkerProfileRequest'), {
            trade: 'Mechanic',
            bio: 'Updated bio.',
            years_experience: 9,
            hourly_rate_kobo: 900000,
            service_radius_m: 18000,
            availability_status: 'available',
            is_online: true,
            location_label: 'Agodi, Ibadan',
            lat: 7.385,
            lng: 3.925,
          }),
          responses: {
            200: dataResponse('Updated worker profile.', schema('WorkerProfile')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/availability': {
        put: {
          tags: ['Workers'],
          operationId: 'setWorkerAvailability',
          summary: 'Set online status and availability',
          security: bearer,
          requestBody: jsonBody(schema('AvailabilityRequest'), {
            is_online: true,
            availability_status: 'available',
          }),
          responses: {
            200: dataResponse('Updated availability.', schema('WorkerProfileSummary')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/services': {
        post: {
          tags: ['Workers'],
          operationId: 'createService',
          summary: 'Create a service',
          security: bearer,
          requestBody: jsonBody(schema('CreateServiceRequest'), {
            title: 'Brake inspection and replacement',
            description: 'Inspection, pad replacement, and road test.',
            pricing_type: 'fixed',
            price_kobo: 1500000,
            duration_minutes: 90,
          }),
          responses: {
            201: dataResponse('Service created.', schema('Service')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/services/{serviceId}': {
        patch: {
          tags: ['Workers'],
          operationId: 'updateService',
          summary: 'Update a service',
          security: bearer,
          parameters: [parameter('ServiceId')],
          requestBody: jsonBody(schema('UpdateServiceRequest'), {
            price_kobo: 1600000,
            is_active: true,
          }),
          responses: {
            200: dataResponse('Updated service.', schema('Service')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
        delete: {
          tags: ['Workers'],
          operationId: 'deactivateService',
          summary: 'Deactivate a service',
          description: 'Soft-deletes the service by setting is_active to false.',
          security: bearer,
          parameters: [parameter('ServiceId')],
          responses: {
            204: { description: 'Service deactivated.' },
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/portfolio': {
        post: {
          tags: ['Workers'],
          operationId: 'addPortfolioItem',
          summary: 'Add a portfolio item',
          security: bearer,
          requestBody: jsonBody(schema('PortfolioRequest'), {
            media_url: 'https://example.com/work/photo.jpg',
            title: 'Engine bay after service',
            sort_order: 1,
          }),
          responses: {
            201: dataResponse('Portfolio item created.', schema('PortfolioItem')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/portfolio/{itemId}': {
        delete: {
          tags: ['Workers'],
          operationId: 'removePortfolioItem',
          summary: 'Remove a portfolio item',
          security: bearer,
          parameters: [parameter('PortfolioItemId')],
          responses: {
            204: { description: 'Portfolio item removed.' },
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/me/verification': {
        post: {
          tags: ['Workers'],
          operationId: 'submitVerification',
          summary: 'Submit a verification request',
          description: 'Creates a pending verification submission and marks the worker profile pending. Only one pending submission is allowed.',
          security: bearer,
          requestBody: jsonBody(schema('VerificationRequest'), {
            id_type: 'nin',
            id_number_last4: '1234',
            selfie_url: 'https://example.com/selfie.jpg',
            certificate_url: 'https://example.com/certificate.pdf',
            references: [{ name: 'Bola Ade', phone: '+2348022222222', relationship: 'Previous client' }],
            notes: 'Available for inspection this week.',
          }),
          responses: {
            201: dataResponse('Verification request submitted.', schema('VerificationSubmission')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
        get: {
          tags: ['Workers'],
          operationId: 'getMyVerification',
          summary: 'Get my latest verification request',
          security: bearer,
          responses: {
            200: dataResponse('Latest verification submission or null.', {
              nullable: true,
              allOf: [schema('VerificationSubmission')],
            }),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/workers/{id}': {
        get: {
          tags: ['Workers'],
          operationId: 'getWorkerProfile',
          summary: 'Get a public worker profile',
          description: 'Public profile with services, portfolio, and reviews. Unverified profiles are hidden from the public but visible to the owner and admins when a token is supplied.',
          security: [{}, { bearerAuth: [] }],
          parameters: [parameter('WorkerId')],
          responses: {
            200: dataResponse('Public worker profile.', schema('WorkerPublic')),
            400: response('ValidationError'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings': {
        post: {
          tags: ['Bookings'],
          operationId: 'createBooking',
          summary: 'Create a booking request',
          description: 'Creates a requested booking after checking worker eligibility, service radius, schedule, and availability. Supply Idempotency-Key to make retries safe.',
          security: bearer,
          parameters: [parameter('IdempotencyKey')],
          requestBody: jsonBody(schema('CreateBookingRequest'), {
            worker_id: '3dd5a2e4-71d0-4da7-a4f3-93d02d3f9f6c',
            description: 'My car will not start. I think it is the battery or starter.',
            address: 'Bodija Market, Ibadan',
            lat: 7.3775,
            lng: 3.947,
            urgency: 'asap',
            payment_method: 'cash',
          }),
          responses: {
            201: dataResponse('Booking created.', schema('Booking')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
        get: {
          tags: ['Bookings'],
          operationId: 'listBookings',
          summary: 'List bookings',
          description: 'Clients see their own bookings, workers see assigned bookings, and admins see all bookings.',
          security: bearer,
          parameters: [
            { name: 'status', in: 'query', required: false, schema: schema('BookingStatus') },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: listResponse('Bookings ordered newest first.', schema('Booking'), {
              type: 'object',
              properties: {
                count: { type: 'integer', example: 2 },
                status: { ...schema('BookingStatus'), nullable: true },
                limit: { type: 'integer', example: 20 },
                offset: { type: 'integer', example: 0 },
              },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}': {
        get: {
          tags: ['Bookings'],
          operationId: 'getBooking',
          summary: 'Get booking detail',
          description: 'Returns the booking, its event timeline, and its review. Only participants and admins can access it.',
          security: bearer,
          parameters: [parameter('BookingId')],
          responses: {
            200: dataResponse('Booking detail.', schema('Booking')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}/accept': {
        post: {
          tags: ['Bookings'],
          operationId: 'acceptBooking',
          summary: 'Accept a booking',
          security: bearer,
          parameters: [parameter('BookingId')],
          responses: {
            200: dataResponse('Booking accepted.', schema('Booking')),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}/decline': {
        post: {
          tags: ['Bookings'],
          operationId: 'declineBooking',
          summary: 'Decline a booking',
          security: bearer,
          parameters: [parameter('BookingId')],
          responses: {
            200: dataResponse('Booking declined.', schema('Booking')),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}/cancel': {
        post: {
          tags: ['Bookings'],
          operationId: 'cancelBooking',
          summary: 'Cancel a booking',
          description: 'Clients and the assigned worker can cancel eligible pre-completion bookings. Paid bookings are marked refunded.',
          security: bearer,
          parameters: [parameter('BookingId')],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: schema('CancelBookingRequest'),
                example: { reason: 'Plans changed.' },
              },
            },
          },
          responses: {
            200: dataResponse('Booking cancelled.', schema('Booking')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}/status': {
        post: {
          tags: ['Bookings'],
          operationId: 'updateBookingStatus',
          summary: 'Progress a booking',
          description: 'Worker-only action. Allowed values are en_route, arrived, in_progress, and completed. The API maps in_progress to the domain action start.',
          security: bearer,
          parameters: [parameter('BookingId')],
          requestBody: jsonBody(schema('BookingStatusUpdateRequest'), { status: 'en_route' }),
          responses: {
            200: dataResponse('Booking status updated.', schema('Booking')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/bookings/{id}/review': {
        post: {
          tags: ['Bookings'],
          operationId: 'reviewBooking',
          summary: 'Review a completed booking',
          security: bearer,
          parameters: [parameter('BookingId')],
          requestBody: jsonBody(schema('ReviewRequest'), {
            rating: 5,
            comment: 'Arrived quickly and explained everything.',
            tags: ['punctual', 'professional'],
          }),
          responses: {
            201: dataResponse('Review created.', schema('Review')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/overview': {
        get: {
          tags: ['Admin'],
          operationId: 'getAdminOverview',
          summary: 'Platform metrics',
          security: bearer,
          responses: {
            200: dataResponse('Admin overview metrics.', schema('AdminOverview')),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/verifications': {
        get: {
          tags: ['Admin'],
          operationId: 'listVerifications',
          summary: 'List verification submissions',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: schema('VerificationSubmissionStatus'),
              example: 'pending',
            },
          ],
          responses: {
            200: listResponse('Verification submissions.', schema('VerificationSubmissionDetail'), {
              type: 'object',
              properties: {
                count: { type: 'integer', example: 1 },
                status: schema('VerificationSubmissionStatus'),
              },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/workers/{workerId}/verification': {
        post: {
          tags: ['Admin'],
          operationId: 'reviewVerification',
          summary: 'Approve or reject a verification',
          description: 'Requires a pending submission. Approval marks the worker verified. Rejection marks the worker rejected and forces them offline.',
          security: bearer,
          parameters: [parameter('VerificationWorkerId')],
          requestBody: jsonBody(schema('VerificationDecisionRequest'), {
            decision: 'approve',
            note: 'Documents checked and clear.',
          }),
          responses: {
            200: dataResponse('Verification reviewed.', {
              type: 'object',
              properties: {
                submission: schema('VerificationSubmission'),
                profile: schema('WorkerProfileSummary'),
              },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            409: response('Conflict'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/users': {
        get: {
          tags: ['Admin'],
          operationId: 'listUsers',
          summary: 'List and search users',
          security: bearer,
          parameters: [
            { name: 'role', in: 'query', required: false, schema: schema('Role') },
            { name: 'status', in: 'query', required: false, schema: schema('AccountStatus') },
            { name: 'search', in: 'query', required: false, schema: { type: 'string', maxLength: 120 }, example: 'emeka' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: listResponse('Matching users.', schema('UserSummary'), {
              type: 'object',
              properties: { count: { type: 'integer', example: 1 } },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/users/{id}/status': {
        patch: {
          tags: ['Admin'],
          operationId: 'setUserStatus',
          summary: 'Suspend or reactivate a user',
          description: 'Admins cannot change their own status or suspend another admin through this endpoint.',
          security: bearer,
          parameters: [parameter('UserId')],
          requestBody: jsonBody(schema('UserStatusRequest'), {
            status: 'suspended',
            reason: 'Repeated no-shows.',
          }),
          responses: {
            200: dataResponse('Updated user.', schema('UserSummary')),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            404: response('NotFound'),
            default: response('InternalError'),
          },
        },
      },

      '/admin/bookings': {
        get: {
          tags: ['Admin'],
          operationId: 'listAllBookings',
          summary: 'List all bookings',
          security: bearer,
          parameters: [
            { name: 'status', in: 'query', required: false, schema: schema('BookingStatus') },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: listResponse('All bookings ordered newest first.', schema('Booking'), {
              type: 'object',
              properties: { count: { type: 'integer', example: 7 } },
            }),
            400: response('ValidationError'),
            401: response('Unauthorized'),
            403: response('Forbidden'),
            default: response('InternalError'),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token. Obtain it from POST /auth/login or POST /auth/signup, then paste it into Authorize. Swagger UI adds the Bearer prefix automatically.',
        },
      },
      parameters: {
        BookingId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Booking UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        WorkerId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Worker user UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        VerificationWorkerId: {
          name: 'workerId',
          in: 'path',
          required: true,
          description: 'Worker user UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        UserId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'User UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        ServiceId: {
          name: 'serviceId',
          in: 'path',
          required: true,
          description: 'Service UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        PortfolioItemId: {
          name: 'itemId',
          in: 'path',
          required: true,
          description: 'Portfolio item UUID.',
          schema: { type: 'string', format: 'uuid' },
        },
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          description: 'Optional retry-safe key scoped to the authenticated user. Reusing a key with a different body returns 409.',
          schema: { type: 'string', maxLength: 200 },
          example: 'create-booking-2026-11-05-001',
        },
      },
      responses: {
        ValidationError: {
          description: 'Request validation failed.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        BadRequest: {
          description: 'Business rule violation.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        Unauthorized: {
          description: 'Missing, invalid, expired, or suspended session.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        Forbidden: {
          description: 'Authenticated but not allowed to perform this action.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        NotFound: {
          description: 'Resource does not exist or is hidden.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        Conflict: {
          description: 'Duplicate record, invalid state transition, unavailable slot, expired idempotency key, or another business conflict.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        RateLimited: {
          description: 'Too many authentication attempts. Retry later.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
        InternalError: {
          description: 'Unexpected server error.',
          content: { 'application/json': { schema: schema('ErrorResponse') } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'The request body or query is invalid.' },
            details: {
              type: 'array',
              nullable: true,
              items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  path: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address' },
                  code: { type: 'string', example: 'invalid_format' },
                },
              },
            },
            request_id: { type: 'string', format: 'uuid' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: { error: schema('Error') },
        },
        HealthLive: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            app: { type: 'string', example: 'skilllink-backend' },
            time: { type: 'string', format: 'date-time' },
          },
        },
        HealthReady: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ready' },
            database: { type: 'string', example: 'ok' },
          },
        },
        HealthUnavailable: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'unavailable' },
            database: { type: 'string', example: 'error' },
          },
        },
        Role: {
          type: 'string',
          enum: ['client', 'worker', 'admin'],
        },
        AccountStatus: {
          type: 'string',
          enum: ['active', 'suspended', 'deleted'],
        },
        VerificationStatus: {
          type: 'string',
          enum: ['draft', 'pending', 'verified', 'rejected'],
        },
        VerificationSubmissionStatus: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected'],
        },
        AvailabilityStatus: {
          type: 'string',
          enum: ['available', 'busy', 'offline'],
        },
        BookingStatus: {
          type: 'string',
          enum: [
            'requested',
            'accepted',
            'en_route',
            'arrived',
            'in_progress',
            'completed',
            'cancelled',
            'declined',
            'expired',
          ],
        },
        Urgency: {
          type: 'string',
          enum: ['asap', 'scheduled', 'emergency'],
        },
        PaymentMethod: {
          type: 'string',
          enum: ['cash', 'card', 'transfer'],
        },
        PaymentStatus: {
          type: 'string',
          enum: ['pending', 'paid', 'refunded'],
        },
        ServicePricingType: {
          type: 'string',
          enum: ['fixed', 'hourly', 'quote'],
        },
        NearbySort: {
          type: 'string',
          enum: ['nearest', 'rating', 'price'],
        },
        Session: {
          type: 'object',
          additionalProperties: true,
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            token_type: { type: 'string', example: 'bearer' },
            expires_in: { type: 'integer', example: 3600 },
            expires_at: { type: 'integer', example: 1762340000 },
            user: { type: 'object', additionalProperties: true },
          },
        },
        Profile: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            role: schema('Role'),
            full_name: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            phone: { type: 'string', nullable: true },
            avatar_url: { type: 'string', nullable: true },
            location_label: { type: 'string', nullable: true },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            status: schema('AccountStatus'),
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            trade: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            years_experience: { type: 'integer', nullable: true },
            hourly_rate_kobo: { type: 'integer', format: 'int64', nullable: true },
            service_radius_m: { type: 'integer', nullable: true },
            is_online: { type: 'boolean', nullable: true },
            availability_status: { nullable: true, allOf: [schema('AvailabilityStatus')] },
            verification_status: { nullable: true, allOf: [schema('VerificationStatus')] },
            rating_avg: { type: 'number', nullable: true },
            rating_count: { type: 'integer', nullable: true },
            jobs_completed: { type: 'integer', nullable: true },
            verified_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        SignupResult: {
          type: 'object',
          properties: {
            user: { type: 'object', additionalProperties: true },
            profile: schema('Profile'),
            session: { nullable: true, allOf: [schema('Session')] },
          },
        },
        LoginResult: {
          type: 'object',
          properties: {
            user: { type: 'object', additionalProperties: true },
            profile: schema('Profile'),
            session: schema('Session'),
          },
        },
        Trade: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string', example: 'mechanic' },
            name: { type: 'string', example: 'Mechanic' },
            icon: { type: 'string', nullable: true, example: 'wrench' },
            sort_order: { type: 'integer', example: 1 },
          },
        },
        Service: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            pricing_type: schema('ServicePricingType'),
            price_kobo: { type: 'integer', format: 'int64' },
            duration_minutes: { type: 'integer', nullable: true },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        PortfolioItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            media_url: { type: 'string', format: 'uri' },
            title: { type: 'string', nullable: true },
            sort_order: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Reference: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            relationship: { type: 'string' },
          },
        },
        VerificationSubmission: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            status: schema('VerificationSubmissionStatus'),
            id_type: { type: 'string', enum: ['nin', 'passport', 'drivers_license', 'voter_card', 'other'] },
            id_number_last4: { type: 'string', nullable: true },
            selfie_url: { type: 'string', format: 'uri' },
            certificate_url: { type: 'string', format: 'uri', nullable: true },
            references: { type: 'array', items: schema('Reference') },
            notes: { type: 'string', nullable: true },
            submitted_at: { type: 'string', format: 'date-time' },
            reviewed_by: { type: 'string', format: 'uuid', nullable: true },
            reviewed_at: { type: 'string', format: 'date-time', nullable: true },
            decision_reason: { type: 'string', nullable: true },
          },
        },
        VerificationSubmissionDetail: {
          allOf: [
            schema('VerificationSubmission'),
            {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string', nullable: true },
                location_label: { type: 'string', nullable: true },
                trade: { type: 'string' },
                years_experience: { type: 'integer' },
                profile_verification_status: schema('VerificationStatus'),
              },
            },
          ],
        },
        WorkerProfileSummary: {
          type: 'object',
          additionalProperties: true,
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            trade: { type: 'string' },
            bio: { type: 'string', nullable: true },
            years_experience: { type: 'integer' },
            hourly_rate_kobo: { type: 'integer', format: 'int64' },
            service_radius_m: { type: 'integer' },
            availability_status: schema('AvailabilityStatus'),
            is_online: { type: 'boolean' },
            verification_status: schema('VerificationStatus'),
            verification_note: { type: 'string', nullable: true },
            rating_avg: { type: 'number' },
            rating_count: { type: 'integer' },
            jobs_completed: { type: 'integer' },
            verified_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        WorkerProfile: {
          allOf: [
            schema('Profile'),
            {
              type: 'object',
              properties: {
                services: { type: 'array', items: schema('Service') },
                portfolio: { type: 'array', items: schema('PortfolioItem') },
                verification: {
                  nullable: true,
                  allOf: [schema('VerificationSubmission')],
                },
              },
            },
          ],
        },
        WorkerPublic: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            full_name: { type: 'string' },
            avatar_url: { type: 'string', nullable: true },
            location_label: { type: 'string', nullable: true },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            trade: { type: 'string' },
            bio: { type: 'string', nullable: true },
            years_experience: { type: 'integer' },
            hourly_rate_kobo: { type: 'integer', format: 'int64' },
            service_radius_m: { type: 'integer' },
            is_online: { type: 'boolean' },
            availability_status: schema('AvailabilityStatus'),
            verification_status: schema('VerificationStatus'),
            rating_avg: { type: 'number' },
            rating_count: { type: 'integer' },
            jobs_completed: { type: 'integer' },
            verified_at: { type: 'string', format: 'date-time', nullable: true },
            services: { type: 'array', items: schema('Service') },
            portfolio: { type: 'array', items: schema('PortfolioItem') },
            reviews: { type: 'array', items: schema('Review') },
          },
        },
        NearbyWorker: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            full_name: { type: 'string' },
            trade: { type: 'string' },
            bio: { type: 'string', nullable: true },
            years_experience: { type: 'integer' },
            hourly_rate_kobo: { type: 'integer', format: 'int64' },
            service_radius_m: { type: 'integer' },
            is_online: { type: 'boolean' },
            verification_status: schema('VerificationStatus'),
            rating_avg: { type: 'number' },
            rating_count: { type: 'integer' },
            jobs_completed: { type: 'integer' },
            location_label: { type: 'string', nullable: true },
            distance_m: { type: 'number', example: 2740.5 },
          },
        },
        BookingEvent: {
          type: 'object',
          properties: {
            id: { type: 'integer', format: 'int64' },
            booking_id: { type: 'string', format: 'uuid' },
            from_status: { nullable: true, allOf: [schema('BookingStatus')] },
            to_status: schema('BookingStatus'),
            actor_id: { type: 'string', format: 'uuid', nullable: true },
            note: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            booking_id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'string', format: 'date-time' },
            client_name: { type: 'string' },
          },
        },
        Booking: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            public_ref: { type: 'string', example: 'SL-2026-A1B2C3' },
            client_id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            trade: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            urgency: schema('Urgency'),
            scheduled_start: { type: 'string', format: 'date-time', nullable: true },
            scheduled_end: { type: 'string', format: 'date-time', nullable: true },
            status: schema('BookingStatus'),
            estimated_price_kobo: { type: 'integer', format: 'int64' },
            final_price_kobo: { type: 'integer', format: 'int64', nullable: true },
            payment_method: schema('PaymentMethod'),
            payment_status: schema('PaymentStatus'),
            cancellation_reason: { type: 'string', nullable: true },
            cancelled_by: { type: 'string', format: 'uuid', nullable: true },
            accepted_at: { type: 'string', format: 'date-time', nullable: true },
            en_route_at: { type: 'string', format: 'date-time', nullable: true },
            arrived_at: { type: 'string', format: 'date-time', nullable: true },
            started_at: { type: 'string', format: 'date-time', nullable: true },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
            cancelled_at: { type: 'string', format: 'date-time', nullable: true },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            version: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            client_name: { type: 'string' },
            client_phone: { type: 'string', nullable: true },
            client_area: { type: 'string', nullable: true },
            worker_name: { type: 'string' },
            worker_phone: { type: 'string', nullable: true },
            worker_area: { type: 'string', nullable: true },
            worker_trade: { type: 'string', nullable: true },
            worker_rating: { type: 'number', nullable: true },
            worker_rating_count: { type: 'integer', nullable: true },
            verification_status: { nullable: true, allOf: [schema('VerificationStatus')] },
            worker_online: { type: 'boolean', nullable: true },
            events: { type: 'array', items: schema('BookingEvent') },
            review: { nullable: true, allOf: [schema('Review')] },
          },
        },
        AdminOverview: {
          type: 'object',
          properties: {
            clients: { type: 'integer', example: 2 },
            workers: { type: 'integer', example: 8 },
            suspended_users: { type: 'integer', example: 0 },
            pending_verifications: { type: 'integer', example: 2 },
            active_bookings: { type: 'integer', example: 1 },
            completed_bookings: { type: 'integer', example: 6 },
            bookings_last_7_days: { type: 'integer', example: 3 },
            gmv_last_30_days_kobo: { type: 'integer', format: 'int64', example: 9600000 },
          },
        },
        UserSummary: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            role: schema('Role'),
            full_name: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            phone: { type: 'string', nullable: true },
            location_label: { type: 'string', nullable: true },
            status: schema('AccountStatus'),
            created_at: { type: 'string', format: 'date-time' },
            trade: { type: 'string', nullable: true },
            verification_status: { nullable: true, allOf: [schema('VerificationStatus')] },
            rating_avg: { type: 'number', nullable: true },
            jobs_completed: { type: 'integer', nullable: true },
          },
        },
        SignupRequest: {
          type: 'object',
          required: ['full_name', 'email', 'password'],
          properties: {
            full_name: { type: 'string', minLength: 2, maxLength: 120 },
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
            phone: { type: 'string', minLength: 7, maxLength: 20 },
            role: { type: 'string', enum: ['client', 'worker'], default: 'client' },
            location_label: { type: 'string', maxLength: 160 },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            trade: { type: 'string', maxLength: 80, description: 'Required when role is worker.' },
            bio: { type: 'string', maxLength: 1500 },
            years_experience: { type: 'integer', minimum: 0, maximum: 60 },
            hourly_rate_kobo: { type: 'integer', minimum: 0, maximum: 100000000 },
            service_radius_m: { type: 'integer', minimum: 1000, maximum: 50000 },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        UpdateMeRequest: {
          type: 'object',
          properties: {
            full_name: { type: 'string', minLength: 2, maxLength: 120 },
            phone: { type: 'string', nullable: true, minLength: 7, maxLength: 20 },
            avatar_url: { type: 'string', format: 'uri', nullable: true },
            location_label: { type: 'string', nullable: true, maxLength: 160 },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
          },
        },
        UpdateWorkerProfileRequest: {
          type: 'object',
          properties: {
            trade: { type: 'string', minLength: 2, maxLength: 80 },
            bio: { type: 'string', nullable: true, maxLength: 1500 },
            years_experience: { type: 'integer', minimum: 0, maximum: 60 },
            hourly_rate_kobo: { type: 'integer', minimum: 0, maximum: 100000000 },
            service_radius_m: { type: 'integer', minimum: 1000, maximum: 50000 },
            availability_status: schema('AvailabilityStatus'),
            is_online: { type: 'boolean' },
            location_label: { type: 'string', nullable: true, maxLength: 160 },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
          },
        },
        AvailabilityRequest: {
          type: 'object',
          required: ['is_online', 'availability_status'],
          properties: {
            is_online: { type: 'boolean' },
            availability_status: schema('AvailabilityStatus'),
          },
        },
        CreateServiceRequest: {
          type: 'object',
          required: ['title', 'pricing_type', 'price_kobo'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 120 },
            description: { type: 'string', nullable: true, maxLength: 1000 },
            pricing_type: schema('ServicePricingType'),
            price_kobo: { type: 'integer', minimum: 0, maximum: 1000000000 },
            duration_minutes: { type: 'integer', minimum: 15, maximum: 1440, nullable: true },
          },
        },
        UpdateServiceRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 120 },
            description: { type: 'string', nullable: true, maxLength: 1000 },
            pricing_type: schema('ServicePricingType'),
            price_kobo: { type: 'integer', minimum: 0, maximum: 1000000000 },
            duration_minutes: { type: 'integer', minimum: 15, maximum: 1440, nullable: true },
            is_active: { type: 'boolean' },
          },
        },
        PortfolioRequest: {
          type: 'object',
          required: ['media_url'],
          properties: {
            media_url: { type: 'string', format: 'uri', maxLength: 2048 },
            title: { type: 'string', nullable: true, maxLength: 120 },
            sort_order: { type: 'integer', minimum: 0, maximum: 1000 },
          },
        },
        VerificationRequest: {
          type: 'object',
          required: ['id_type', 'selfie_url'],
          properties: {
            id_type: { type: 'string', enum: ['nin', 'passport', 'drivers_license', 'voter_card', 'other'] },
            id_number_last4: { type: 'string', pattern: '^\\d{4}$' },
            selfie_url: { type: 'string', format: 'uri', maxLength: 2048 },
            certificate_url: { type: 'string', format: 'uri', maxLength: 2048 },
            references: { type: 'array', maxItems: 5, items: schema('Reference') },
            notes: { type: 'string', maxLength: 1000 },
          },
        },
        CreateBookingRequest: {
          type: 'object',
          required: ['worker_id', 'description', 'address', 'lat', 'lng'],
          properties: {
            worker_id: { type: 'string', format: 'uuid' },
            description: { type: 'string', minLength: 10, maxLength: 2000 },
            address: { type: 'string', minLength: 5, maxLength: 300 },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            urgency: { type: 'string', enum: ['asap', 'scheduled', 'emergency'], default: 'asap' },
            scheduled_start: { type: 'string', format: 'date-time', description: 'Required when urgency is scheduled.' },
            scheduled_end: { type: 'string', format: 'date-time', description: 'Optional. Defaults to two hours after scheduled_start.' },
            payment_method: schema('PaymentMethod'),
            service_id: { type: 'string', format: 'uuid' },
          },
        },
        CancelBookingRequest: {
          type: 'object',
          properties: {
            reason: { type: 'string', maxLength: 500 },
          },
        },
        BookingStatusUpdateRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['en_route', 'arrived', 'in_progress', 'completed'] },
          },
        },
        ReviewRequest: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', maxLength: 1000 },
            tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 40 } },
          },
        },
        VerificationDecisionRequest: {
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['approve', 'reject'] },
            note: { type: 'string', maxLength: 1000 },
          },
        },
        UserStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['active', 'suspended'] },
            reason: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
  };
}

export const openapiDocument = buildOpenApiDocument();
