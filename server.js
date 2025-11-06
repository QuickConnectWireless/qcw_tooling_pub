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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: db !== null,
    database: DATABASE
  });
});

// Query (find)
app.post('/query', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, query = {}, options = {} } = req.body;
    
    const coll = db.collection(collection);
    let cursor = coll.find(query);
    
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    
    const results = await cursor.toArray();
    res.json(results);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aggregate
app.post('/aggregate', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, pipeline } = req.body;
    
    const coll = db.collection(collection);
    const results = await coll.aggregate(pipeline).toArray();
    
    res.json(results);
  } catch (error) {
    console.error('Aggregate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Count
app.post('/count', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, query = {} } = req.body;
    
    const coll = db.collection(collection);
    const count = await coll.countDocuments(query);
    
    res.json({ count });
  } catch (error) {
    console.error('Count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Distinct
app.post('/distinct', async (req, res) => {
  try {
    await connectToMongo();
    const { collection, field, query = {} } = req.body;
    
    const coll = db.collection(collection);
    const values = await coll.distinct(field, query);
    
    res.json(values);
  } catch (error) {
    console.error('Distinct error:', error);
    res.status(500).json({ error: error.message });
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
