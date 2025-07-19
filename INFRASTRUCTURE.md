# MeetGenieAI Infrastructure Setup

This document outlines the infrastructure configuration for MeetGenieAI, including database, background job processing, and environment management.

## Overview

MeetGenieAI uses a cloud-first approach with the following key infrastructure components:

- **Database**: Supabase PostgreSQL (cloud-hosted)
- **Background Jobs**: Inngest for reliable job processing
- **Cache**: Redis (containerized)
- **Message Broker**: Apache Kafka (containerized)
- **Authentication**: Clerk
- **File Storage**: Supabase Storage
- **AI Services**: OpenAI, LangChain, LangSmith, Pinecone

## Database Configuration

### Supabase PostgreSQL

We've migrated from local PostgreSQL to Supabase for better scalability and managed services.

**Required Environment Variables:**
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_supabase_database_url
```

**Setup Steps:**
1. Create a Supabase project at https://supabase.com
2. Copy your project URL and API keys from the project settings
3. Update your `.env` file with the Supabase credentials
4. The Supabase client is configured in `libs/shared/src/lib/config/supabase.config.ts`

### Database Access

The application provides two types of database clients:

- **Admin Client**: For server-side operations with full permissions
- **Regular Client**: For user-facing operations with row-level security

```typescript
import { SupabaseService } from '@meetgenie/shared';

// In your service
constructor(private supabaseService: SupabaseService) {}

// Use admin client for server operations
const adminClient = this.supabaseService.getAdminClient();

// Use regular client for user operations
const client = this.supabaseService.getClient();
```

## Background Job Processing

### Inngest Configuration

Inngest handles all background job processing including:
- Meeting transcription processing
- AI summarization workflows
- Billing cycle processing
- Email notifications

**Required Environment Variables:**
```bash
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
INNGEST_BASE_URL=https://api.inngest.com
```

**Setup Steps:**
1. Create an Inngest account at https://inngest.com
2. Create a new app and copy the event key and signing key
3. Update your `.env` file with the Inngest credentials
4. The Inngest client is configured in `libs/shared/src/lib/config/inngest.config.ts`

### Local Development

For local development, you can use the Inngest dev server:

```bash
# Start with dev profile to include Inngest dev server
docker-compose --profile dev up -d

# The Inngest dev UI will be available at http://localhost:8288
```

## Environment Variables Management

### Comprehensive Configuration

All environment variables are managed through a centralized configuration system in `libs/shared/src/lib/config/environment.config.ts`.

### Required Environment Variables

Copy `.env.example` to `.env` and fill in the following:

#### Core Infrastructure
```bash
NODE_ENV=development
```

#### Database (Supabase)
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_supabase_database_url
```

#### Background Jobs (Inngest)
```bash
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
INNGEST_BASE_URL=https://api.inngest.com
```

#### Authentication (Clerk)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

#### AI Services
```bash
OPENAI_API_KEY=your_openai_api_key
LANGCHAIN_API_KEY=your_langchain_api_key
LANGSMITH_API_KEY=your_langsmith_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
```

#### Payment Services
```bash
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

#### Meeting Platform APIs
```bash
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
TEAMS_CLIENT_ID=your_teams_client_id
TEAMS_CLIENT_SECRET=your_teams_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

#### Local Services (Redis & Kafka)
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=meetgenie-microservices
KAFKA_GROUP_ID=meetgenie-group
```

#### Service Ports
```bash
API_GATEWAY_PORT=3001
AUTH_SERVICE_PORT=3002
USER_SERVICE_PORT=3003
MEETING_SERVICE_PORT=3004
TRANSCRIPTION_SERVICE_PORT=3005
SUMMARIZATION_SERVICE_PORT=3006
QA_SERVICE_PORT=3007
PAYMENT_SERVICE_PORT=3008
BILLING_SERVICE_PORT=3009
ADMIN_SERVICE_PORT=3010
```

#### CORS Configuration
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200
```

## Docker Services

### Available Services

The `docker-compose.yml` includes the following services:

1. **Redis**: Cache and session storage
2. **Zookeeper**: Kafka coordination service
3. **Kafka**: Message broker for microservices communication
4. **Kafka UI**: Web interface for Kafka management (http://localhost:8080)
5. **Inngest Dev**: Local development server for Inngest (http://localhost:8288)

### Starting Services

```bash
# Start core services (Redis, Kafka)
docker-compose up -d

# Start with development tools (includes Inngest dev server)
docker-compose --profile dev up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Service Health Checks

All services include health checks to ensure proper startup order and monitoring.

## Security Considerations

### Environment Variables

- Never commit `.env` files to version control
- Use different credentials for development, staging, and production
- Rotate API keys regularly
- Use least-privilege access for service accounts

### Database Security

- Supabase provides built-in security with Row Level Security (RLS)
- Use service role key only for server-side operations
- Implement proper authentication and authorization

### API Keys Management

- Store sensitive keys in environment variables
- Use different keys for different environments
- Monitor API usage and set up alerts for unusual activity

## Monitoring and Logging

### Health Checks

Each service includes health check endpoints:

```typescript
// Example health check in a service
@Get('health')
async healthCheck() {
  const supabaseHealth = await this.supabaseService.healthCheck();
  const redisHealth = await this.redisService.healthCheck();
  
  return {
    status: 'ok',
    services: {
      supabase: supabaseHealth ? 'healthy' : 'unhealthy',
      redis: redisHealth ? 'healthy' : 'unhealthy',
    },
  };
}
```

### Logging

- Structured logging with proper log levels
- Centralized logging for microservices
- Error tracking and alerting

## Development Workflow

### Local Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in the required values
3. Install dependencies: `pnpm install`
4. Start infrastructure services: `docker-compose --profile dev up -d`
5. Start the application services

### Testing

- Unit tests for configuration validation
- Integration tests for external service connections
- Health check endpoints for monitoring

## Troubleshooting

### Common Issues

1. **Supabase Connection Issues**
   - Verify URL and API keys are correct
   - Check network connectivity
   - Ensure project is not paused

2. **Inngest Job Failures**
   - Check event key and signing key
   - Verify webhook endpoints are accessible
   - Review job logs in Inngest dashboard

3. **Redis/Kafka Connection Issues**
   - Ensure Docker services are running
   - Check port availability
   - Verify network configuration

### Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Test Redis connection
docker-compose exec redis redis-cli ping

# Test Kafka connection
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

## Migration Notes

### From Local PostgreSQL to Supabase

1. **Database Schema**: Export existing schema and import to Supabase
2. **Data Migration**: Use Supabase migration tools or custom scripts
3. **Connection Strings**: Update all services to use Supabase connection
4. **Authentication**: Integrate with Supabase Auth or continue with Clerk
5. **File Storage**: Migrate files to Supabase Storage

### Environment Variable Changes

- `DATABASE_URL`: Now points to Supabase
- Added Supabase-specific variables
- Added Inngest configuration
- Removed local PostgreSQL variables