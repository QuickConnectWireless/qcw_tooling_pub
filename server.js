/**
 * Super Simple MongoDB HTTP Proxy
 * Bridges Cloudflare Workers to MongoDB
 */

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

// Configuration
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI; // Required - must be set via environment variable
const DATABASE = process.env.DATABASE || 'Saica';

// Validate required environment variables
if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is required!');
  console.error('   Set it in your Render dashboard or .env file');
  process.exit(1);
}

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB client (reuse connection)
let mongoClient = null;
let db = null;

// Connect to MongoDB
async function connectToMongo() {
  if (mongoClient) return;
  
  try {
    console.log('Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(DATABASE);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Health check (enhanced diagnostics)
app.get('/health', async (req, res) => {
  const health = { 
    status: 'ok', 
    connected: db !== null,
    database: DATABASE,
    timestamp: new Date().toISOString()
  };
  
  // Test actual database connectivity
  if (db) {
    try {
      await db.admin().ping();
      health.ping = 'success';
      
      // Try to count documents in network_tests
      const count = await db.collection('network_tests').countDocuments();
      health.testCollection = 'accessible';
      health.documentCount = count;
    } catch (error) {
      health.ping = 'failed';
      health.pingError = error.message;
      health.status = 'degraded';
    }
  }
  
  res.json(health);
});

// Diagnostic endpoint - test database operations
app.get('/diagnose', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      port: PORT,
      database: DATABASE,
      mongoUriConfigured: !!MONGODB_URI,
      mongoUriHost: MONGODB_URI ? MONGODB_URI.split('@')[1]?.split('/')[0] : 'not configured'
    },
    connection: {
      clientInitialized: !!mongoClient,
      dbInitialized: !!db
    },
    tests: {}
  };
  
  // Test 1: Connection
  try {
    await connectToMongo();
    diagnostics.tests.connection = { status: 'success' };
  } catch (error) {
    diagnostics.tests.connection = { status: 'failed', error: error.message };
    return res.json(diagnostics);
  }
  
  // Test 2: Ping
  try {
    await db.admin().ping();
    diagnostics.tests.ping = { status: 'success' };
  } catch (error) {
    diagnostics.tests.ping = { status: 'failed', error: error.message };
  }
  
  // Test 3: List collections
  try {
    const collections = await db.listCollections().toArray();
    diagnostics.tests.listCollections = { 
      status: 'success', 
      count: collections.length,
      collections: collections.map(c => c.name)
    };
  } catch (error) {
    diagnostics.tests.listCollections = { status: 'failed', error: error.message };
  }
  
  // Test 4: Query network_tests
  try {
    const count = await db.collection('network_tests').countDocuments();
    const sample = await db.collection('network_tests').findOne();
    diagnostics.tests.networkTests = { 
      status: 'success', 
      count,
      hasSampleData: !!sample
    };
  } catch (error) {
    diagnostics.tests.networkTests = { status: 'failed', error: error.message };
  }
  
  res.json(diagnostics);
});

// Query (find)
app.post('/query', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, query = {}, options = {} } = req.body;
    
    console.log(`[QUERY] Collection: ${collection}, Query:`, JSON.stringify(query), 'Options:', JSON.stringify(options));
    
    const coll = db.collection(collection);
    let cursor = coll.find(query);
    
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    
    const results = await cursor.toArray();
    console.log(`[QUERY] Success: returned ${results.length} documents`);
    res.json(results);
  } catch (error) {
    console.error('[QUERY] Error:', error.message, error.stack);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

// Aggregate
app.post('/aggregate', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, pipeline } = req.body;
    
    console.log(`[AGGREGATE] Collection: ${collection}, Pipeline:`, JSON.stringify(pipeline));
    
    const coll = db.collection(collection);
    const results = await coll.aggregate(pipeline).toArray();
    
    console.log(`[AGGREGATE] Success: returned ${results.length} documents`);
    res.json(results);
  } catch (error) {
    console.error('[AGGREGATE] Error:', error.message, error.stack);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

// Count
app.post('/count', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, query = {} } = req.body;
    
    console.log(`[COUNT] Collection: ${collection}, Query:`, JSON.stringify(query));
    
    const coll = db.collection(collection);
    const count = await coll.countDocuments(query);
    
    console.log(`[COUNT] Success: ${count} documents`);
    res.json({ count });
  } catch (error) {
    console.error('[COUNT] Error:', error.message, error.stack);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

// Distinct
app.post('/distinct', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, field, query = {} } = req.body;
    
    console.log(`[DISTINCT] Collection: ${collection}, Field: ${field}, Query:`, JSON.stringify(query));
    
    const coll = db.collection(collection);
    const values = await coll.distinct(field, query);
    
    console.log(`[DISTINCT] Success: ${values.length} unique values`);
    res.json(values);
  } catch (error) {
    console.error('[DISTINCT] Error:', error.message, error.stack);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

// Insert One
app.post('/insertOne', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, document } = req.body;
    
    const coll = db.collection(collection);
    const result = await coll.insertOne(document);
    
    res.json(result);
  } catch (error) {
    console.error('InsertOne error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Insert Many
app.post('/insertMany', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, documents } = req.body;
    
    const coll = db.collection(collection);
    const result = await coll.insertMany(documents);
    
    res.json(result);
  } catch (error) {
    console.error('InsertMany error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 MongoDB Proxy Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Database: ${DATABASE}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // Test connection on startup
  try {
    await connectToMongo();
    console.log('✅ MongoDB connection verified\n');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.error('   Check your MONGODB_URI\n');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  if (mongoClient) {
    await mongoClient.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});
