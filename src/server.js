import express from 'express';
import cors from 'cors';
import ngrok from '@ngrok/ngrok';
import { config } from './config.js';
import meetingRoutes from './routes/meetingRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

const app = express();

// Store ngrok URL for access in other parts of the app
let ngrokPublicUrl = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware for debugging
app.use((req, res, next) => {
  if (req.path.includes('/webhooks') || req.path.includes('/regenerate-note')) {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    });
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint to verify route registration
app.get('/api/test-routes', (req, res) => {
  const routes = [];
  meetingRoutes.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      const path = `/api/meetings${layer.route.path}`;
      routes.push({ methods, path });
    }
  });
  res.json({ routes });
});

// Get webhook URL endpoint
app.get('/webhook-url', (req, res) => {
  if (ngrokPublicUrl) {
    res.json({
      webhookUrl: `${ngrokPublicUrl}/api/webhooks/nylas`,
      publicUrl: ngrokPublicUrl,
    });
  } else {
    res.json({
      webhookUrl: null,
      message: 'Ngrok not configured or not running',
    });
  }
});

// API Routes
app.use('/api/meetings', meetingRoutes);
app.use('/api/webhooks', webhookRoutes);

// Debug: Log all registered routes on startup
console.log('\n📋 Registered API Routes:');
meetingRoutes.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
    const path = `/api/meetings${layer.route.path}`;
    console.log(`   ${methods.padEnd(8)} ${path}`);
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Meeting Note Taker API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhookUrl: '/webhook-url',
      meetings: '/api/meetings',
      webhooks: '/api/webhooks/nylas',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  console.log('   Available routes: /api/meetings, /api/webhooks');
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    message: `No route found for ${req.method} ${req.path}`
  });
});

// Start server
const PORT = config.server.port;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${config.server.env}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Initialize ngrok if configured
  if (config.ngrok.authtoken) {
    try {
      await ngrok.authtoken(config.ngrok.authtoken);

      const ngrokOptions = {
        addr: PORT,
      };

      // Use custom domain only if provided and not a placeholder
      // Custom domains require a paid ngrok plan
      const domain = config.ngrok.domain?.trim();
      if (domain &&
        domain !== 'your_custom_domain.ngrok.io' &&
        domain !== 'your_actual_domain_here' &&
        !domain.includes('your_') &&
        domain.endsWith('.ngrok.io')) {
        ngrokOptions.domain = domain;
        console.log(`   Using custom domain: ${domain}`);
      } else if (domain && domain !== 'your_custom_domain.ngrok.io' && domain !== 'your_actual_domain_here') {
        console.warn(`   ⚠️  Custom domain "${domain}" may require a paid ngrok plan. Using default domain instead.`);
      }

      const listener = await ngrok.forward(ngrokOptions);
      const publicUrl = listener.url();
      ngrokPublicUrl = publicUrl;

      console.log(`\n🌐 Ngrok tunnel established!`);
      console.log(`   Public URL: ${publicUrl}`);
      console.log(`   Webhook URL: ${publicUrl}/api/webhooks/nylas`);
      console.log(`\n   ⚠️  Make sure to configure this webhook URL in your Nylas dashboard!`);
      console.log(`   💡 You can also GET /webhook-url to retrieve the webhook URL programmatically.\n`);
    } catch (error) {
      console.error('❌ Error starting ngrok:', error.message);
      if (error.message.includes('custom hostname') || error.message.includes('paid plan')) {
        console.error('   💡 Tip: Remove NGROK_DOMAIN from .env to use the free ngrok domain, or upgrade to a paid plan for custom domains.');
      }
      console.error('   Server will continue running on localhost only.');
    }
  } else {
    console.log(`\n⚠️  NGROK_AUTHTOKEN not set. Running on localhost only.`);
    console.log(`   To enable ngrok, set NGROK_AUTHTOKEN in your .env file.\n`);
  }
});

