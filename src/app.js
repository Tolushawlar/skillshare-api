import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestContext } from './middleware/request.js';
import { apiRouter } from './routes/index.js';
import { healthRouter } from './routes/health.js';

export const app = express();

const openapiDocument = buildOpenApiDocument({
  prefix: env.API_PREFIX,
  localUrl: env.isProduction ? undefined : `http://localhost:${env.PORT}${env.API_PREFIX}`,
});

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestContext);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      ...(env.isProduction ? {} : { upgradeInsecureRequests: null }),
    },
  },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use('/health', healthRouter);
app.use(env.API_PREFIX, apiRouter);

app.get('/openapi.json', (_req, res) => {
  res.json(openapiDocument);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, {
  customSiteTitle: 'SkillLink API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'method',
    docExpansion: 'none',
    defaultModelsExpandDepth: 1,
  },
}));

app.use(notFound);
app.use(errorHandler);
