const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventHub API',
      version: '1.1.0',
      description:
        'REST API for the EventHub event-management platform — covers auth, events, bookings, payments, messaging, and OTP.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development server' },
    ],
    tags: [
      { name: 'Auth',     description: 'Signup, login, profile, password reset, avatar' },
      { name: 'OTP',      description: 'One-time password generation and verification' },
      { name: 'Events',   description: 'Event CRUD (organizer-owned) and public listings' },
      { name: 'Bookings', description: 'Ticket booking, cancellation, refund quotes, ticket status' },
      { name: 'Scanner',  description: 'Organizer in-app gate scanner — one-time-use ticket validation' },
      { name: 'Payments', description: 'Payment recording and history' },
      { name: 'Messages', description: 'Attendee ↔ organizer chat threads' },
      { name: 'AI',       description: 'Streaming AI assistant (proxies the Spring Boot/Groq service)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:                       { type: 'integer' },
            name:                     { type: 'string' },
            mobile:                   { type: 'string', pattern: '^[0-9]{10}$' },
            email:                    { type: 'string', format: 'email' },
            role:                     { type: 'string', enum: ['organizer', 'explorer'] },
            profile_image:            { type: 'string', nullable: true },
            address:                  { type: 'string', nullable: true },
            organization_name:        { type: 'string', nullable: true },
            organization_address:     { type: 'string', nullable: true },
            organization_phone:       { type: 'string', nullable: true },
            organization_website:     { type: 'string', nullable: true },
            organization_description: { type: 'string', nullable: true },
            last_seen:                { type: 'string', format: 'date-time' },
            created_at:               { type: 'string', format: 'date-time' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id:               { type: 'integer' },
            organizer_id:     { type: 'integer' },
            title:            { type: 'string' },
            description:      { type: 'string' },
            category:         { type: 'string' },
            location:         { type: 'string' },
            place:            { type: 'string', nullable: true, description: 'City / region' },
            map_url:          { type: 'string', nullable: true, description: 'Google Maps link' },
            event_date:       { type: 'string', format: 'date-time' },
            ticket_price:     { type: 'number', format: 'float' },
            total_seats:      { type: 'integer' },
            available_seats:  { type: 'integer' },
            image_url:        { type: 'string', nullable: true },
            images:           { type: 'array', items: { type: 'string' } },
            created_at:       { type: 'string', format: 'date-time' },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            id:                   { type: 'integer' },
            user_id:              { type: 'integer' },
            event_id:             { type: 'integer' },
            seats_booked:         { type: 'integer' },
            total_price:          { type: 'number' },
            booking_status:       { type: 'string', enum: ['confirmed', 'cancelled'], example: 'confirmed' },
            ticket_id:            { type: 'string' },
            ticket_holder_name:   { type: 'string', nullable: true },
            ticket_holder_email:  { type: 'string', nullable: true },
            ticket_holder_mobile: { type: 'string', nullable: true },
            transaction_id:       { type: 'string', nullable: true },
            cancelled_at:         { type: 'string', format: 'date-time', nullable: true },
            refund_amount:        { type: 'number', nullable: true },
            cancellation_reason:  { type: 'string', nullable: true },
            created_at:           { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id:             { type: 'integer' },
            booking_id:     { type: 'integer' },
            amount:         { type: 'number' },
            payment_method: { type: 'string', example: 'upi' },
            payment_status: { type: 'string', example: 'success' },
            transaction_id: { type: 'string' },
            created_at:     { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id:           { type: 'integer' },
            event_id:     { type: 'integer' },
            sender_id:    { type: 'integer' },
            recipient_id: { type: 'integer' },
            body:         { type: 'string' },
            read_at:      { type: 'string', format: 'date-time', nullable: true },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
      responses: {
        Unauthorized:  { description: 'Missing or invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        BadRequest:    { description: 'Invalid request body / params',  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        NotFound:      { description: 'Resource not found',             content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        ServerError:   { description: 'Internal server error',          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  apis: [],
};

const spec = swaggerJsdoc(options);

// ─────────────────────────────────────────────────────────────────────
// Path definitions — every mounted endpoint, grouped by router file.
// ─────────────────────────────────────────────────────────────────────
spec.paths = {

  // ═══════════════════════════════════════════════════════════════════
  // AUTH  (/api/auth)
  // ═══════════════════════════════════════════════════════════════════
  '/api/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      description: 'Creates a new user. Optionally accepts an OTP `verification_token` to confirm the email.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'email', 'password', 'role'],
              properties: {
                name:               { type: 'string' },
                mobile:             { type: 'string', pattern: '^[0-9]{10}$' },
                email:              { type: 'string', format: 'email' },
                password:           { type: 'string', minLength: 6 },
                role:               { type: 'string', enum: ['organizer', 'explorer'] },
                verification_token: { type: 'string', description: 'Optional — issued by /api/otp/verify with purpose=signup' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'User created — returns user + JWT', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        409: { description: 'User already exists' },
      },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Authenticate user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email:    { type: 'string', format: 'email' },
                password: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Login successful — returns user + JWT', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/auth/send-otp': {
    post: {
      tags: ['Auth'],
      summary: 'Legacy OTP send (use /api/otp/send instead)',
      deprecated: true,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } } },
      responses: { 200: { description: 'OTP sent (or surfaced in dev mode)' } },
    },
  },

  '/api/auth/profile': {
    get: {
      tags: ['Auth'],
      summary: 'Get the authenticated user\'s profile',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/auth/update-profile': {
    put: {
      tags: ['Auth'],
      summary: 'Update profile fields',
      description: 'Email and mobile changes require a fresh OTP verification token.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name:                       { type: 'string' },
                email:                      { type: 'string', format: 'email' },
                mobile:                     { type: 'string', pattern: '^[0-9]{10}$' },
                address:                    { type: 'string' },
                organization_name:          { type: 'string' },
                organization_address:       { type: 'string' },
                organization_phone:         { type: 'string' },
                organization_website:       { type: 'string' },
                organization_description:   { type: 'string' },
                email_verification_token:   { type: 'string', description: 'Required when changing email' },
                mobile_verification_token:  { type: 'string', description: 'Required when changing mobile' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Profile updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/auth/upload-avatar': {
    post: {
      tags: ['Auth'],
      summary: 'Upload profile avatar',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { avatar: { type: 'string', format: 'binary' } },
              required: ['avatar'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Avatar uploaded', content: { 'application/json': { schema: { type: 'object', properties: { profile_image: { type: 'string' } } } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/auth/forgot-password/request': {
    post: {
      tags: ['Auth'],
      summary: 'Look up account before sending password-reset OTP',
      description: 'Confirms a user exists with the given email or mobile. Frontend then calls /api/otp/send with purpose=password-reset.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email:  { type: 'string', format: 'email' },
                mobile: { type: 'string', pattern: '^[0-9]{10}$' },
              },
              description: 'Provide either email or mobile — at least one is required.',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User found',
          content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, name: { type: 'string' }, delivered_to: { type: 'string', description: 'Masked email' }, target_type: { type: 'string', enum: ['email', 'mobile'] } } } } },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/auth/forgot-password/reset': {
    post: {
      tags: ['Auth'],
      summary: 'Reset password using a verified OTP token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['verification_token', 'new_password'],
              properties: {
                email:              { type: 'string', format: 'email' },
                mobile:             { type: 'string', pattern: '^[0-9]{10}$' },
                verification_token: { type: 'string', description: 'Token returned by /api/otp/verify' },
                new_password:       { type: 'string', minLength: 6 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Password reset' },
        400: { $ref: '#/components/responses/BadRequest' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/auth/users': {
    get: {
      tags: ['Auth'],
      summary: 'List all registered users (organizer only)',
      description: 'Paginated list of users with optional role filter and free-text search across name, email, and mobile. Never returns password hashes.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'role',   in: 'query', required: false, schema: { type: 'string', enum: ['organizer', 'explorer'] }, description: 'Filter by role' },
        { name: 'search', in: 'query', required: false, schema: { type: 'string' }, description: 'Case-insensitive partial match on name, email, or mobile' },
        { name: 'limit',  in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
        { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
      ],
      responses: {
        200: {
          description: 'Paginated user list',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              total:  { type: 'integer', description: 'Total users matching the filter (across all pages)' },
              limit:  { type: 'integer' },
              offset: { type: 'integer' },
              count:  { type: 'integer', description: 'Number of users returned in this page' },
              users:  { type: 'array', items: { $ref: '#/components/schemas/User' } },
            },
          } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { description: 'Caller is not an organizer' },
      },
    },
  },

  '/api/auth/users/{id}': {
    delete: {
      tags: ['Auth'],
      summary: 'Delete a user (organizer only)',
      description: `Permanently deletes the target user along with **all** their dependent
records — bookings, events, messages, and check-ins — via the existing \`ON DELETE CASCADE\`
foreign-key constraints. This is irreversible.

Safety:
- Caller must be authenticated and have role \`organizer\`
- Caller cannot delete their own account from this endpoint (returns 400)`,
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Target user id' },
      ],
      responses: {
        200: {
          description: 'User deleted',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'User foo@bar.com deleted along with their bookings, events, and messages.' },
              deleted: {
                type: 'object',
                properties: {
                  id:    { type: 'integer' },
                  name:  { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role:  { type: 'string', enum: ['organizer', 'explorer'] },
                },
              },
            },
          } } },
        },
        400: { description: 'Invalid id, or attempted self-deletion' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { description: 'Caller is not an organizer' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // OTP  (/api/otp)
  // ═══════════════════════════════════════════════════════════════════
  '/api/otp/send': {
    post: {
      tags: ['OTP'],
      summary: 'Generate and email a 6-digit OTP',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['target', 'target_type', 'purpose'],
              properties: {
                target:      { type: 'string', description: 'Email address or 10-digit mobile' },
                target_type: { type: 'string', enum: ['email', 'mobile'] },
                purpose:     { type: 'string', enum: ['signup', 'update-email', 'update-mobile', 'password-reset'] },
                name:        { type: 'string', description: 'Optional — used in email greeting' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'OTP sent (or surfaced in dev mode if SMTP unavailable)',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              delivered_to: { type: 'string', description: 'Masked email' },
              via: { type: 'string', enum: ['email'] },
              target_type: { type: 'string' },
              expires_in_min: { type: 'integer' },
              devMode: { type: 'boolean' },
              otp: { type: 'string', description: 'Only present when devMode=true' },
            },
          } } },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/otp/verify': {
    post: {
      tags: ['OTP'],
      summary: 'Verify the OTP and receive a single-use verification token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['target', 'code', 'purpose'],
              properties: {
                target:  { type: 'string' },
                code:    { type: 'string', pattern: '^[0-9]{6}$' },
                purpose: { type: 'string', enum: ['signup', 'update-email', 'update-mobile', 'password-reset'] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Returns verification_token (15-min TTL, single-use)', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, verification_token: { type: 'string' }, target: { type: 'string' }, purpose: { type: 'string' }, target_type: { type: 'string' }, expires_at: { type: 'string', format: 'date-time' } } } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        429: { description: 'Too many failed attempts — request a new OTP' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS  (/api/events)
  // ═══════════════════════════════════════════════════════════════════
  '/api/events': {
    get: {
      tags: ['Events'],
      summary: 'List all public events',
      responses: {
        200: { description: 'Array of events', content: { 'application/json': { schema: { type: 'object', properties: { events: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } } } } },
      },
    },
    post: {
      tags: ['Events'],
      summary: 'Create a new event (organizer)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['title', 'category', 'event_date', 'location', 'ticket_price', 'total_seats', 'description'],
              properties: {
                title:        { type: 'string' },
                category:     { type: 'string' },
                event_date:   { type: 'string', format: 'date-time' },
                location:     { type: 'string' },
                place:        { type: 'string' },
                map_url:      { type: 'string' },
                ticket_price: { type: 'number' },
                total_seats:  { type: 'integer' },
                description:  { type: 'string' },
                image:        { type: 'string', format: 'binary', description: 'Cover image' },
                images:       { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Up to 10 additional images' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Event created', content: { 'application/json': { schema: { type: 'object', properties: { event: { $ref: '#/components/schemas/Event' } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/events/my-events': {
    get: {
      tags: ['Events'],
      summary: 'List events created by the authenticated organizer',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Array of events', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/events/{id}': {
    get: {
      tags: ['Events'],
      summary: 'Get event details',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Event details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Events'],
      summary: 'Update an event (organizer must own it)',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                title:        { type: 'string' },
                category:     { type: 'string' },
                event_date:   { type: 'string', format: 'date-time' },
                location:     { type: 'string' },
                place:        { type: 'string' },
                map_url:      { type: 'string' },
                ticket_price: { type: 'number' },
                total_seats:  { type: 'integer' },
                description:  { type: 'string' },
                image:        { type: 'string', format: 'binary' },
                images:       { type: 'array', items: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Event updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { description: 'Not the owner' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Events'],
      summary: 'Delete an event',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Event deleted' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // BOOKINGS  (/api/bookings)
  // ═══════════════════════════════════════════════════════════════════
  '/api/bookings': {
    get: {
      tags: ['Bookings'],
      summary: 'List the authenticated user\'s bookings',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Bookings list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Bookings'],
      summary: 'Create a booking (book seats for an event)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event_id', 'seats_booked'],
              properties: {
                event_id:             { type: 'integer' },
                seats_booked:         { type: 'integer', minimum: 1 },
                ticket_holder_name:   { type: 'string' },
                ticket_holder_email:  { type: 'string', format: 'email' },
                ticket_holder_mobile: { type: 'string', pattern: '^[0-9]{10}$' },
                transaction_id:       { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Booking confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/bookings/{id}': {
    get: {
      tags: ['Bookings'],
      summary: 'Get a single booking by id',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Booking details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/bookings/{id}/cancel-quote': {
    get: {
      tags: ['Bookings'],
      summary: 'Get the refund quote before cancelling',
      description: 'Returns the refund amount based on time-tier policy: >48h → full refund, 48–12h → 25%, 12–4h → 50%, <4h → none.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Refund quote', content: { 'application/json': { schema: { type: 'object', properties: { refund_amount: { type: 'number' }, tier: { type: 'string' }, hours_until_event: { type: 'number' } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/bookings/{id}/cancel': {
    put: {
      tags: ['Bookings'],
      summary: 'Cancel a booking',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { reason: { type: 'string', description: 'Cancellation reason — shown to organizer' } },
            },
          },
        },
      },
      responses: {
        200: { description: 'Booking cancelled — refund_amount recorded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/bookings/organizer/all': {
    get: {
      tags: ['Bookings'],
      summary: 'Organizer view of all bookings on their events',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'All bookings on the organizer\'s events', content: { 'application/json': { schema: { type: 'array', items: { allOf: [{ $ref: '#/components/schemas/Booking' }, { type: 'object', properties: { event_title: { type: 'string' }, user_name: { type: 'string' } } }] } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/bookings/ticket-status/{bookingId}': {
    get: {
      tags: ['Bookings'],
      summary: 'Public ticket status (used by QR-code verify pages)',
      parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string', description: 'Booking id or ticket_id' } }],
      responses: {
        200: { description: 'Ticket status', content: { 'application/json': { schema: { type: 'object', properties: { booking_status: { type: 'string', enum: ['confirmed', 'cancelled'] }, event_title: { type: 'string' } } } } } },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PAYMENTS  (/api/payments)
  // ═══════════════════════════════════════════════════════════════════
  '/api/payments': {
    get: {
      tags: ['Payments'],
      summary: 'List the authenticated user\'s payment history',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Payments list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Payment' } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Payments'],
      summary: 'Record a payment for a booking',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['booking_id', 'amount', 'payment_method'],
              properties: {
                booking_id:     { type: 'integer' },
                amount:         { type: 'number' },
                payment_method: { type: 'string', example: 'upi' },
                payment_status: { type: 'string', example: 'success' },
                transaction_id: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Payment recorded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Payment' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGES  (/api/messages)
  // ═══════════════════════════════════════════════════════════════════
  '/api/messages/threads': {
    get: {
      tags: ['Messages'],
      summary: 'List all chat threads the user is part of',
      description: 'Returns one row per (event_id, other_user) pair with the last message preview.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Thread list', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { event_id: { type: 'integer' }, event_title: { type: 'string' }, other_user_id: { type: 'integer' }, other_user_name: { type: 'string' }, last_body: { type: 'string' }, unread_count: { type: 'integer' }, last_at: { type: 'string', format: 'date-time' } } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages/thread/{eventId}/{otherId}': {
    get: {
      tags: ['Messages'],
      summary: 'Fetch the full message thread between this user and `otherId` for an event',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'eventId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'otherId', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      responses: {
        200: { description: 'Messages array', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Message' } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages': {
    post: {
      tags: ['Messages'],
      summary: 'Send a message',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event_id', 'recipient_id', 'body'],
              properties: {
                event_id:     { type: 'integer' },
                recipient_id: { type: 'integer' },
                body:         { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Message sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/Message' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages/my-events': {
    get: {
      tags: ['Messages'],
      summary: 'List events that have at least one message thread',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Events with active threads', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages/event-attendees/{eventId}': {
    get: {
      tags: ['Messages'],
      summary: 'List attendees who have messaged about a given event',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Attendees list', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { user_id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, last_at: { type: 'string', format: 'date-time' }, unread_count: { type: 'integer' } } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages/unread-count': {
    get: {
      tags: ['Messages'],
      summary: 'Total unread messages for the authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Unread count', content: { 'application/json': { schema: { type: 'object', properties: { unread_count: { type: 'integer' } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/messages/{id}': {
    put: {
      tags: ['Messages'],
      summary: 'Edit a message (sender only)',
      description: 'Updates the body of an existing message. Only the original sender can edit. Sets `edited_at = NOW()` so the UI can show an "(edited)" label.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['body'],
              properties: { body: { type: 'string', maxLength: 4000 } }
            }
          }
        }
      },
      responses: {
        200: { description: 'Updated message', content: { 'application/json': { schema: { $ref: '#/components/schemas/Message' } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { description: 'Message not found or not owned by the caller' },
      },
    },
    delete: {
      tags: ['Messages'],
      summary: 'Delete a message (sender only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, id: { type: 'integer' } } } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { description: 'Message not found or not owned by the caller' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SCANNER  (/api/bookings/scanner)
  // Organizer's in-app gate scanner — one-time-use ticket validation.
  // ═══════════════════════════════════════════════════════════════════
  '/api/bookings/scanner/events': {
    get: {
      tags: ['Scanner'],
      summary: 'List the organizer\'s events with scan stats for the picker',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Events with booked + scanned counters',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id:            { type: 'integer' },
                    title:         { type: 'string' },
                    event_date:    { type: 'string', format: 'date-time' },
                    location:      { type: 'string' },
                    total_seats:   { type: 'integer' },
                    image_url:     { type: 'string', nullable: true },
                    booked_seats:  { type: 'integer' },
                    scanned_count: { type: 'integer' },
                  },
                },
              },
            },
          } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/bookings/scanner/event/{eventId}/stats': {
    get: {
      tags: ['Scanner'],
      summary: 'Live counters + last 10 check-ins for one event',
      description: 'Polled every few seconds by the scanner UI so the gate stats stay fresh.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'Stats payload',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              event_id:          { type: 'integer' },
              title:             { type: 'string' },
              total_seats:       { type: 'integer' },
              booked_seats:      { type: 'integer' },
              scanned_count:     { type: 'integer' },
              remaining_to_scan: { type: 'integer' },
              recent_scans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id:             { type: 'integer' },
                    seat_code:      { type: 'string' },
                    checked_in_at:  { type: 'string', format: 'date-time' },
                    attendee_name:  { type: 'string', nullable: true },
                  },
                },
              },
            },
          } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { description: 'Not the event organizer' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/bookings/scanner/scan': {
    post: {
      tags: ['Scanner'],
      summary: 'Validate a ticket QR and record a check-in',
      description: `Walks the validation chain:\n
- Verify the organizer owns the event
- Find the booking by \`ticket_id\` (or via the \`b\` param embedded in the QR URL)
- Reject if it's for a different event (\`wrong-event\`)
- Reject if it's cancelled (\`cancelled\`)
- INSERT into \`check_ins\` — the unique index on \`seat_code\` enforces one-time-use

Possible \`reason\` values when \`ok=false\`:
\`empty-qr\` · \`missing-event-id\` · \`event-not-found\` · \`not-your-event\`
· \`ticket-not-found\` · \`wrong-event\` · \`cancelled\` · \`already-scanned\``,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event_id', 'qr_text'],
              properties: {
                event_id: { type: 'integer' },
                qr_text:  { type: 'string', description: 'Raw QR text (typically a verify-page URL with `?t=<seat_code>&b=<booking_id>`)' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Check-in recorded',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              ok:            { type: 'boolean', example: true },
              seat_code:     { type: 'string' },
              booking_id:    { type: 'integer' },
              attendee:      { type: 'string', nullable: true },
              scanned_at:    { type: 'string', format: 'date-time' },
              scanned_count: { type: 'integer', description: 'New total for this event' },
            },
          } } },
        },
        400: { description: 'Bad request', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, reason: { type: 'string' } } } } } },
        403: { description: 'Not the event organizer' },
        404: { description: 'Event or ticket not found' },
        409: {
          description: 'Already scanned, or ticket is for a different event',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              ok:               { type: 'boolean', example: false },
              reason:           { type: 'string', enum: ['already-scanned', 'wrong-event'] },
              seat_code:        { type: 'string' },
              first_scanned_at: { type: 'string', format: 'date-time', nullable: true },
              expected_event:   { type: 'integer', nullable: true },
            },
          } } },
        },
        410: { description: 'Booking is cancelled' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // AI  (/api/ai)
  // Node proxy that streams Server-Sent Events from the Spring Boot
  // (Groq) AI service. The browser never talks to the AI host directly.
  // ═══════════════════════════════════════════════════════════════════
  '/api/ai/health': {
    get: {
      tags: ['AI'],
      summary: 'AI service health passthrough',
      description: 'Returns 200 when the upstream Spring Boot AI service is reachable; 503 otherwise. Used by the chat widget to flip its status dot to "Offline" gracefully.',
      responses: {
        200: { description: 'AI service is up', content: { 'text/plain': { schema: { type: 'string', example: 'AI service is running' } } } },
        503: { description: 'AI service unavailable' },
      },
    },
  },

  '/api/ai/chat': {
    post: {
      tags: ['AI'],
      summary: 'Streaming AI chat — proxies SSE from the Spring Boot service',
      description: `Forwards the request to the upstream AI service (\`/api/ai/chat/stream\`)
and pipes the resulting Server-Sent Events stream straight back to the browser.

The response **Content-Type is \`text/event-stream\`** — each frame looks like:

\`\`\`
data: Hello
data: ,\\u0020how
data:  can
data:  I help?
data: [DONE]
\`\`\`

\`data: [DONE]\` signals end of stream. \`data: [ERROR] <message>\` indicates an
upstream failure (e.g. AI service down) and is followed by \`[DONE]\`.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['message'],
              properties: {
                message: { type: 'string', example: 'Suggest creative event ideas for a college fest' },
                history: {
                  type: 'array',
                  description: 'Optional prior conversation turns for multi-turn context.',
                  items: {
                    type: 'object',
                    properties: {
                      role:    { type: 'string', enum: ['user', 'assistant'] },
                      content: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'SSE stream of token chunks', content: { 'text/event-stream': { schema: { type: 'string' } } } },
        400: { $ref: '#/components/responses/BadRequest' },
        503: { description: 'AI service unreachable — surfaced as `data: [ERROR] ...` in the stream' },
      },
    },
  },
};

module.exports = spec;
console.log('Swagger specification generated successfully.');
console.log('API documentation available at http://localhost:3000/api-docs');
