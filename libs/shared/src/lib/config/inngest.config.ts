import { Inngest } from 'inngest';

export interface InngestConfig {
  eventKey: string;
  signingKey: string;
  baseUrl: string;
}

export const getInngestConfig = (): InngestConfig => {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  const baseUrl = process.env.INNGEST_BASE_URL || 'https://api.inngest.com';

  if (!eventKey || !signingKey) {
    throw new Error(
      'Missing required Inngest environment variables: INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY'
    );
  }

  return {
    eventKey,
    signingKey,
    baseUrl,
  };
};

// Create Inngest client instance
export const createInngestClient = (appId: string) => {
  const config = getInngestConfig();
  
  return new Inngest({
    id: appId,
    eventKey: config.eventKey,
  });
};

// Export a default client for general use
export const inngest = createInngestClient('meetgenie-ai');