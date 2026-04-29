const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management API',
      version: '1.0.0',
      description: 'API documentation for the Event Organizer and Explorer platform',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            mobile: { type: 'string', pattern: '^[0-9]{10}$' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['organizer', 'explorer'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            organizer_id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            location: { type: 'string' },
            event_date: { type: 'string', format: 'date-time' },
            price: { type: 'number' },
            total_seats: { type: 'integer' },
            available_seats: { type: 'integer' },
            images: { type: 'array', items: { type: 'string' } }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            event_id: { type: 'integer' },
            seats_booked: { type: 'integer' },
            total_price: { type: 'number' },
            booking_status: { type: 'string', example: 'confirmed' }
          }
        }
      }
    }
  },
  apis: [], // We will define paths directly in this object for clarity
};

const spec = swaggerJsdoc(options);

// Manually adding paths to the spec based on your server.js routes
spec.paths = {
  '/api/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'password', 'role'],
              properties: {
                name: { type: 'string' },
                mobile: { type: 'string' },
                email: { type: 'string' },
                password: { type: 'string' },
                role: { type: 'string', enum: ['organizer', 'explorer'] }
              }
            }
          }
        }
      },
      responses: { 201: { description: 'User created' } }
    }
  },
  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile', 'password'],
              properties: {
                mobile: { type: 'string' },
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: { 200: { description: 'Login successful' } }
    }
  },
  '/api/auth/profile': {
    get: {
      tags: ['Auth'],
      summary: 'Get user profile',
      security: [{ bearerAuth: [] }],
      responses: { 200: { description: 'Profile data' } }
    }
  },
  '/api/events': {
    get: {
      tags: ['Events'],
      summary: 'List all events',
      responses: { 200: { description: 'List of events' } }
    },
    post: {
      tags: ['Events'],
      summary: 'Create a new event',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Event' }
          }
        }
      },
      responses: { 201: { description: 'Event created' } }
    }
  },
  '/api/events/{id}': {
    get: {
      tags: ['Events'],
      summary: 'Get event details',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Event details' } }
    },
    put: {
      tags: ['Events'],
      summary: 'Update event',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Event updated' } }
    },
    delete: {
      tags: ['Events'],
      summary: 'Delete event',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Event deleted' } }
    }
  },
  '/api/bookings': {
    post: {
      tags: ['Bookings'],
      summary: 'Create a booking',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                event_id: { type: 'integer' },
                seats_booked: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: { 201: { description: 'Booking confirmed' } }
    },
    get: {
      tags: ['Bookings'],
      summary: 'Get user bookings',
      security: [{ bearerAuth: [] }],
      responses: { 200: { description: 'User bookings list' } }
    }
  },
  '/api/payments': {
    post: {
      tags: ['Payments'],
      summary: 'Record a payment',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                booking_id: { type: 'integer' },
                amount: { type: 'number' },
                payment_method: { type: 'string' },
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: { 200: { description: 'Payment recorded' } }
    }
  }
};

module.exports = spec;
console.log("Swagger specification generated successfully.");
console.log("API documentation available at http://localhost:3000/api-docs");