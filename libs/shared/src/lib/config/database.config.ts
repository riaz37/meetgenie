import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  // Supabase database URL (contains all connection info)
  url: process.env['DATABASE_URL'],
  // Enable logging in development
  logging: process.env['NODE_ENV'] === 'development',
  // Connection pool settings for Supabase
  pool: {
    max: 20,
    min: 5,
    idle: 10000,
  },
}));