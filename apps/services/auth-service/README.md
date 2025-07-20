# Auth Service

The Auth Service provides comprehensive authentication and authorization functionality for the MeetGenie application, with seamless integration to Clerk for user management and PostgreSQL database synchronization.

## Features

### Core Authentication
- **Clerk Integration**: Seamless integration with Clerk for user authentication
- **Session Management**: Secure session token validation and management
- **Database Synchronization**: Real-time sync between Clerk and local database via webhooks
- **User Management**: Complete user lifecycle management (create, update, deactivate, reactivate)

### Authorization & Permissions
- **Role-Based Access Control**: Permission system based on subscription tiers
- **Route Protection**: Authentication guards for protecting API endpoints
- **Permission Checking**: Granular permission validation
- **Subscription Tier Management**: Dynamic permission assignment based on user subscription

### Database Integration
- **Prisma ORM**: Type-safe database operations with PostgreSQL
- **Connection Management**: Robust database connection handling with health checks
- **Transaction Support**: Safe database operations with transaction support
- **Audit Logging**: Comprehensive logging for all authentication events

## API Endpoints

### Authentication
- `POST /auth/authenticate` - Authenticate user with session token
- `GET /auth/me` - Get current authenticated user information

### User Management
- `GET /auth/users/:userId` - Get user by ID
- `PUT /auth/users/:userId/subscription` - Update user subscription tier
- `PUT /auth/users/:userId/preferences` - Update user preferences
- `GET /auth/users/:userId/activity` - Get user activity status
- `POST /auth/users/:userId/deactivate` - Deactivate user account
- `POST /auth/users/:userId/reactivate` - Reactivate user account

### Permissions
- `GET /auth/users/:userId/permissions/:permission` - Check user permission

### Admin Operations
- `GET /auth/admin/stats` - Get user statistics
- `POST /auth/admin/sync/:clerkUserId` - Sync specific user from Clerk
- `POST /auth/admin/batch-sync` - Batch sync users from Clerk

### Webhooks
- `POST /webhooks/clerk` - Clerk webhook endpoint for user synchronization

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with database status

## Webhook Integration

The service automatically synchronizes user data with Clerk through webhooks:

### Supported Events
- `user.created` - Creates new user in local database
- `user.updated` - Updates existing user information
- `user.deleted` - Marks user as deleted (soft delete)

### Security
- **Signature Verification**: All webhooks are verified using Clerk's signature validation
- **Error Handling**: Comprehensive error handling with retry mechanisms
- **Logging**: Detailed logging for all webhook events

## Permission System

### Subscription Tiers
- **Free**: Basic permissions (read:meetings, create:meetings, read:profile, update:profile)
- **Pro**: Enhanced permissions (+ advanced:summaries, export:data, create:integrations, advanced:analytics)
- **Enterprise**: Full permissions (+ admin:users, admin:billing, bulk:operations)

### Usage Examples

```typescript
// Protect route with authentication
@UseGuards(ClerkAuthGuard)
@Get('protected')
async getProtectedResource(@CurrentUser() user: UserSession) {
  return { message: `Hello ${user.name}` };
}

// Require specific permissions
@UseGuards(ClerkAuthGuard)
@RequirePermissions('admin:users')
@Get('admin/users')
async getUsers() {
  // Only users with admin:users permission can access
}

// Public route (no authentication required)
@Public()
@Get('public')
async getPublicData() {
  return { message: 'This is public' };
}
```

## Configuration

### Environment Variables
```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database Configuration
DATABASE_URL=postgresql://...
PRISMA_LOG_LEVEL=query,info,warn,error

# Service Configuration
AUTH_SERVICE_PORT=3002
```

### Clerk Webhook Setup
1. Configure webhook endpoint in Clerk dashboard: `https://your-domain.com/webhooks/clerk`
2. Select events: `user.created`, `user.updated`, `user.deleted`
3. Copy webhook signing secret to environment variables

## Database Schema

The service uses the following key database tables:

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  subscription_tier subscription_tier DEFAULT 'free',
  preferences JSONB DEFAULT '{}',
  clerk_sync_status VARCHAR(50),
  last_clerk_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);
```

## Error Handling

The service provides comprehensive error handling:

- **Authentication Errors**: Clear error messages for invalid tokens or sessions
- **Authorization Errors**: Specific permission requirement messages
- **Database Errors**: Graceful handling of database connectivity issues
- **Webhook Errors**: Retry mechanisms for failed webhook processing

## Monitoring & Health Checks

### Health Endpoints
- Basic health check includes service status and timestamp
- Detailed health check includes database connectivity, connection pool status, and memory usage

### Logging
- Structured logging with different levels (debug, info, warn, error)
- Request/response logging for all authentication attempts
- Database query logging (configurable)
- Webhook event logging

## Testing

The service includes comprehensive unit tests:

```bash
# Run tests
npm test auth-service

# Run tests with coverage
npm run test:cov auth-service
```

## Deployment

### Docker Support
The service is containerized and can be deployed using Docker:

```bash
# Build image
docker build -t meetgenie/auth-service .

# Run container
docker run -p 3002:3002 meetgenie/auth-service
```

### Environment Setup
1. Set up PostgreSQL database
2. Configure Clerk application
3. Set environment variables
4. Run database migrations
5. Start the service

## Security Considerations

- **Token Validation**: All session tokens are validated with Clerk
- **Signature Verification**: Webhook signatures are cryptographically verified
- **SQL Injection Protection**: Prisma ORM provides built-in protection
- **Rate Limiting**: Consider implementing rate limiting for public endpoints
- **HTTPS Only**: Always use HTTPS in production
- **Environment Variables**: Never commit secrets to version control

## Troubleshooting

### Common Issues
1. **Database Connection**: Check DATABASE_URL and network connectivity
2. **Clerk Integration**: Verify API keys and webhook configuration
3. **Permission Errors**: Check user subscription tier and permission mappings
4. **Webhook Failures**: Verify signature validation and endpoint accessibility

### Debug Mode
Enable debug logging by setting `PRISMA_LOG_LEVEL=query,info,warn,error` to see detailed database queries and operations.