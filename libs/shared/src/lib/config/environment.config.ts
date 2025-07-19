import { registerAs } from '@nestjs/config';

export interface EnvironmentConfig {
  // Environment
  nodeEnv: string;
  
  // Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  
  // Inngest
  inngest: {
    eventKey: string;
    signingKey: string;
    baseUrl: string;
  };
  
  // Clerk Authentication
  clerk: {
    publishableKey: string;
    secretKey: string;
    signInUrl: string;
    signUpUrl: string;
    afterSignInUrl: string;
    afterSignUpUrl: string;
  };
  
  // AI Services
  ai: {
    openaiApiKey: string;
    langchainApiKey: string;
    langsmithApiKey: string;
    pineconeApiKey: string;
    pineconeEnvironment: string;
  };
  
  // Payment Services
  payment: {
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  };
  
  // Meeting Platform APIs
  meetingPlatforms: {
    zoom: {
      clientId: string;
      clientSecret: string;
    };
    teams: {
      clientId: string;
      clientSecret: string;
    };
    google: {
      clientId: string;
      clientSecret: string;
    };
  };
  
  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  
  // Kafka
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  
  // Service Ports
  services: {
    apiGateway: number;
    auth: number;
    user: number;
    meeting: number;
    transcription: number;
    summarization: number;
    qa: number;
    payment: number;
    billing: number;
    admin: number;
  };
  
  // CORS
  cors: {
    allowedOrigins: string[];
  };
}

export default registerAs('environment', (): EnvironmentConfig => {
  // Helper function to get required environment variable
  const getRequiredEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  };

  // Helper function to get optional environment variable with default
  const getOptionalEnv = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
  };

  // Helper function to parse comma-separated values
  const parseArray = (value: string): string[] => {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  };

  return {
    nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
    
    supabase: {
      url: getRequiredEnv('SUPABASE_URL'),
      anonKey: getRequiredEnv('SUPABASE_ANON_KEY'),
      serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
    
    inngest: {
      eventKey: getRequiredEnv('INNGEST_EVENT_KEY'),
      signingKey: getRequiredEnv('INNGEST_SIGNING_KEY'),
      baseUrl: getOptionalEnv('INNGEST_BASE_URL', 'https://api.inngest.com'),
    },
    
    clerk: {
      publishableKey: getRequiredEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
      secretKey: getRequiredEnv('CLERK_SECRET_KEY'),
      signInUrl: getOptionalEnv('NEXT_PUBLIC_CLERK_SIGN_IN_URL', '/sign-in'),
      signUpUrl: getOptionalEnv('NEXT_PUBLIC_CLERK_SIGN_UP_URL', '/sign-up'),
      afterSignInUrl: getOptionalEnv('NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', '/dashboard'),
      afterSignUpUrl: getOptionalEnv('NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL', '/dashboard'),
    },
    
    ai: {
      openaiApiKey: getRequiredEnv('OPENAI_API_KEY'),
      langchainApiKey: getRequiredEnv('LANGCHAIN_API_KEY'),
      langsmithApiKey: getRequiredEnv('LANGSMITH_API_KEY'),
      pineconeApiKey: getRequiredEnv('PINECONE_API_KEY'),
      pineconeEnvironment: getRequiredEnv('PINECONE_ENVIRONMENT'),
    },
    
    payment: {
      stripePublishableKey: getRequiredEnv('STRIPE_PUBLISHABLE_KEY'),
      stripeSecretKey: getRequiredEnv('STRIPE_SECRET_KEY'),
      stripeWebhookSecret: getRequiredEnv('STRIPE_WEBHOOK_SECRET'),
    },
    
    meetingPlatforms: {
      zoom: {
        clientId: getRequiredEnv('ZOOM_CLIENT_ID'),
        clientSecret: getRequiredEnv('ZOOM_CLIENT_SECRET'),
      },
      teams: {
        clientId: getRequiredEnv('TEAMS_CLIENT_ID'),
        clientSecret: getRequiredEnv('TEAMS_CLIENT_SECRET'),
      },
      google: {
        clientId: getRequiredEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
    
    redis: {
      host: getOptionalEnv('REDIS_HOST', 'localhost'),
      port: parseInt(getOptionalEnv('REDIS_PORT', '6379'), 10),
      password: process.env['REDIS_PASSWORD'] || undefined,
      db: parseInt(getOptionalEnv('REDIS_DB', '0'), 10),
    },
    
    kafka: {
      brokers: parseArray(getOptionalEnv('KAFKA_BROKERS', 'localhost:9092')),
      clientId: getOptionalEnv('KAFKA_CLIENT_ID', 'meetgenie-microservices'),
      groupId: getOptionalEnv('KAFKA_GROUP_ID', 'meetgenie-group'),
    },
    
    services: {
      apiGateway: parseInt(getOptionalEnv('API_GATEWAY_PORT', '3001'), 10),
      auth: parseInt(getOptionalEnv('AUTH_SERVICE_PORT', '3002'), 10),
      user: parseInt(getOptionalEnv('USER_SERVICE_PORT', '3003'), 10),
      meeting: parseInt(getOptionalEnv('MEETING_SERVICE_PORT', '3004'), 10),
      transcription: parseInt(getOptionalEnv('TRANSCRIPTION_SERVICE_PORT', '3005'), 10),
      summarization: parseInt(getOptionalEnv('SUMMARIZATION_SERVICE_PORT', '3006'), 10),
      qa: parseInt(getOptionalEnv('QA_SERVICE_PORT', '3007'), 10),
      payment: parseInt(getOptionalEnv('PAYMENT_SERVICE_PORT', '3008'), 10),
      billing: parseInt(getOptionalEnv('BILLING_SERVICE_PORT', '3009'), 10),
      admin: parseInt(getOptionalEnv('ADMIN_SERVICE_PORT', '3010'), 10),
    },
    
    cors: {
      allowedOrigins: parseArray(getOptionalEnv('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:4200')),
    },
  };
});