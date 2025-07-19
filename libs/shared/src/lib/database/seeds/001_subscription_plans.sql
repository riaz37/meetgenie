-- Seed data for subscription plans
-- This file contains initial subscription plans for MeetGenieAI

INSERT INTO subscription_plans (id, name, description, price, currency, interval, features, limits, is_active) VALUES
(
  uuid_generate_v4(),
  'Free',
  'Perfect for trying out MeetGenieAI with basic features',
  0.00,
  'USD',
  'monthly',
  '[
    {"name": "Meeting Recording", "description": "Record up to 3 meetings per month", "included": true},
    {"name": "Real-time Transcription", "description": "Live transcription during meetings", "included": true},
    {"name": "Basic Summaries", "description": "AI-generated meeting summaries", "included": true},
    {"name": "Q&A Search", "description": "Search and ask questions about your meetings", "included": true},
    {"name": "Email Support", "description": "Support via email", "included": true}
  ]',
  '{
    "monthlyMeetings": 3,
    "transcriptionMinutes": 180,
    "storageGB": 1,
    "participantsPerMeeting": 10,
    "apiCallsPerMonth": 100
  }',
  true
),
(
  uuid_generate_v4(),
  'Pro',
  'For professionals and small teams who need more meetings and advanced features',
  29.99,
  'USD',
  'monthly',
  '[
    {"name": "Unlimited Meetings", "description": "Record unlimited meetings", "included": true},
    {"name": "Real-time Transcription", "description": "Live transcription during meetings", "included": true},
    {"name": "Advanced Summaries", "description": "Detailed AI summaries with action items", "included": true},
    {"name": "Smart Q&A", "description": "Advanced search across all meetings", "included": true},
    {"name": "Speaker Identification", "description": "Automatic speaker detection and labeling", "included": true},
    {"name": "Custom AI Instructions", "description": "Customize AI behavior and output format", "included": true},
    {"name": "Priority Support", "description": "Priority email and chat support", "included": true},
    {"name": "Integrations", "description": "Connect with Zoom, Teams, Google Meet, WebEx", "included": true}
  ]',
  '{
    "monthlyMeetings": -1,
    "transcriptionMinutes": 3000,
    "storageGB": 50,
    "participantsPerMeeting": 50,
    "apiCallsPerMonth": 5000
  }',
  true
),
(
  uuid_generate_v4(),
  'Enterprise',
  'For large organizations with advanced security and compliance needs',
  99.99,
  'USD',
  'monthly',
  '[
    {"name": "Everything in Pro", "description": "All Pro features included", "included": true},
    {"name": "Advanced Analytics", "description": "Detailed meeting analytics and insights", "included": true},
    {"name": "Admin Dashboard", "description": "Comprehensive admin controls", "included": true},
    {"name": "SSO Integration", "description": "Single sign-on with your identity provider", "included": true},
    {"name": "Advanced Security", "description": "Enhanced security and compliance features", "included": true},
    {"name": "Custom Integrations", "description": "Custom API integrations and webhooks", "included": true},
    {"name": "Dedicated Support", "description": "Dedicated customer success manager", "included": true},
    {"name": "SLA Guarantee", "description": "99.9% uptime SLA", "included": true}
  ]',
  '{
    "monthlyMeetings": -1,
    "transcriptionMinutes": -1,
    "storageGB": 500,
    "participantsPerMeeting": 500,
    "apiCallsPerMonth": 50000
  }',
  true
),
(
  uuid_generate_v4(),
  'Pro Annual',
  'Pro plan billed annually with 20% discount',
  287.90,
  'USD',
  'yearly',
  '[
    {"name": "Unlimited Meetings", "description": "Record unlimited meetings", "included": true},
    {"name": "Real-time Transcription", "description": "Live transcription during meetings", "included": true},
    {"name": "Advanced Summaries", "description": "Detailed AI summaries with action items", "included": true},
    {"name": "Smart Q&A", "description": "Advanced search across all meetings", "included": true},
    {"name": "Speaker Identification", "description": "Automatic speaker detection and labeling", "included": true},
    {"name": "Custom AI Instructions", "description": "Customize AI behavior and output format", "included": true},
    {"name": "Priority Support", "description": "Priority email and chat support", "included": true},
    {"name": "Integrations", "description": "Connect with Zoom, Teams, Google Meet, WebEx", "included": true}
  ]',
  '{
    "monthlyMeetings": -1,
    "transcriptionMinutes": 3000,
    "storageGB": 50,
    "participantsPerMeeting": 50,
    "apiCallsPerMonth": 5000
  }',
  true
),
(
  uuid_generate_v4(),
  'Enterprise Annual',
  'Enterprise plan billed annually with 20% discount',
  959.90,
  'USD',
  'yearly',
  '[
    {"name": "Everything in Pro", "description": "All Pro features included", "included": true},
    {"name": "Advanced Analytics", "description": "Detailed meeting analytics and insights", "included": true},
    {"name": "Admin Dashboard", "description": "Comprehensive admin controls", "included": true},
    {"name": "SSO Integration", "description": "Single sign-on with your identity provider", "included": true},
    {"name": "Advanced Security", "description": "Enhanced security and compliance features", "included": true},
    {"name": "Custom Integrations", "description": "Custom API integrations and webhooks", "included": true},
    {"name": "Dedicated Support", "description": "Dedicated customer success manager", "included": true},
    {"name": "SLA Guarantee", "description": "99.9% uptime SLA", "included": true}
  ]',
  '{
    "monthlyMeetings": -1,
    "transcriptionMinutes": -1,
    "storageGB": 500,
    "participantsPerMeeting": 500,
    "apiCallsPerMonth": 50000
  }',
  true
);