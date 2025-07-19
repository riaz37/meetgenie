const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'meetgenie-topic-initializer',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
});

const topics = [
  'meeting-events',
  'transcription-events',
  'payment-events',
  'user-events',
  'summary-events',
  'qa-events',
  'admin-events',
  'billing-events',
];

async function createTopics() {
  const admin = kafka.admin();
  
  try {
    await admin.connect();
    console.log('Connected to Kafka admin');
    
    const existingTopics = await admin.listTopics();
    console.log('Existing topics:', existingTopics);
    
    const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic));
    
    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            {
              name: 'cleanup.policy',
              value: 'delete'
            },
            {
              name: 'retention.ms',
              value: '604800000' // 7 days
            }
          ]
        })),
      });
      
      console.log('Created topics:', topicsToCreate);
    } else {
      console.log('All topics already exist');
    }
    
    await admin.disconnect();
    console.log('Kafka topics initialization completed');
  } catch (error) {
    console.error('Error creating Kafka topics:', error);
    process.exit(1);
  }
}

createTopics();