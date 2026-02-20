const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const supabase = require('./config/supabase');
const { sendEmails } = require('./config/email');

// Load environment variables
require('dotenv').config();




const app = express();

// =================== CONFIG ===================
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// ================= MIDDLEWARE =================

// Allow requests from both the main domain and Vercel backend
const allowedOrigins = [
  "https://www.sayoneventures.com",
  "https://backend-sandy-delta-67.vercel.app"
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.options("*", cors());

app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10kb' }));

// Security headers
app.use((req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  next();
});

// ================= VALIDATION =================
const validateContact = [
  // Sanitize and validate name
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters')
    .escape(),

  // Sanitize and validate email
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),

  // Sanitize and validate message
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ max: 5000 }).withMessage('Message must be less than 5000 characters')
    .escape(),

  // Custom validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => err.msg) 
      });
    }
    next();
  }
];

// Rate limiting
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many contact form submissions from this IP, please try again after 15 minutes'
  }
});

// ================= AUTH ======================

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }

  const base64 = authHeader.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) return next();
  return res.status(401).send('Invalid credentials');
}

// ================= ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ========== ADMIN CONTACT DASHBOARD ==========

app.get('/admin/contacts', adminAuth, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rowsHtml = rows.length
      ? rows
          .map(
            (row) => `
            <tr>
              <td>${row.id}</td>
              <td>${row.name}</td>
              <td>${row.email}</td>
              <td>${(row.message || '')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')}</td>
              <td>${new Date(row.created_at).toLocaleString()}</td>
            </tr>
          `
          )
          .join('')
      : `<tr><td colspan="5">No contact submissions found.</td></tr>`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin - Contact Submissions</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: #f5f5f5;
  margin: 0;
  padding: 0;
}
.container {
  max-width: 1200px;
  margin: auto;
  padding: 20px;
}
h1 {
  color: #2d5016;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}
th, td {
  padding: 12px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}
th {
  background: #2d5016;
  color: #fff;
}
tr:nth-child(even) {
  background: #fafafa;
}
.note {
  margin-top: 10px;
  font-size: 12px;
  color: #555;
}
</style>
</head>
<body>
<div class="container">
<h1>Contact Submissions</h1>
<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>Email</th>
<th>Message</th>
<th>Date</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
<div class="note">
Protected by Basic Authentication
</div>
</div>
</body>
</html>
    `;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load admin dashboard');
  }
});

// ========== TEST EMAIL ENDPOINT ==========
app.get('/api/test-email', async (req, res) => {
    try {
        // Use the SMTP user's email for testing
        if (!process.env.SMTP_USER) {
            throw new Error('SMTP_USER is not configured in environment variables');
        }
        
        const testEmail = process.env.SMTP_USER; // Send test to the SMTP user's email
        const testName = 'Test User';
        const testMessage = 'This is a test message to verify email functionality';
        
        console.log('Sending test emails to:', testEmail);
        console.log('Using SMTP server:', process.env.SMTP_HOST);
        
        const result = await sendEmails(testName, testEmail, testMessage);
        
        if (result.success) {
            console.log('Test emails sent successfully');
            res.json({
                success: true,
                message: 'Test emails sent successfully!',
                details: `Check ${testEmail} and ${process.env.ADMIN_EMAIL} for test messages.`
            });
        } else {
            console.error('Failed to send test emails:', result);
            res.status(500).json({
                success: false,
                error: 'Failed to send test emails',
                details: result.details || 'No additional error details',
                code: result.code || 'UNKNOWN_ERROR'
            });
        }
    } catch (error) {
        console.error('Error in test email endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// ========== CONTACT FORM ==========

app.post('/api/contact', [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('message').trim().isLength({ min: 1 }).withMessage('Message is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, message } = req.body;

  try {
    // Save to database
    const { data, error } = await supabase
      .from('contacts')
      .insert([{ name, email, message }])
      .select();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Forward to n8n webhook if configured
    let webhookSuccess = true;
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        
        if (!webhookResponse.ok) {
          console.error('Webhook failed:', webhookResponse.status, webhookResponse.statusText);
          webhookSuccess = false;
        } else {
          console.log('Webhook forwarded successfully');
        }
      } catch (webhookError) {
        console.error('Error forwarding to webhook:', webhookError);
        webhookSuccess = false;
      }
    }

    // Send notification to admin
    let notificationSuccess = true;
    try {
      const notificationResult = await sendEmails(name, email, message);
      if (!notificationResult.success) {
        console.error('Failed to send admin notification:', notificationResult.error);
        notificationSuccess = false;
      }
    } catch (notifError) {
      console.error('Error sending admin notification:', notifError);
      notificationSuccess = false;
    }

    // Prepare response
    const response = { 
      success: true,
      message: 'Thank you for your message! We\'ll get back to you soon.'
    };

    // Add warnings if there were issues
    const warnings = [];
    if (!notificationSuccess) {
      warnings.push('There was an issue sending email notifications');
    }
    if (!webhookSuccess) {
      warnings.push('There was an issue forwarding to the workflow system');
    }
    
    if (warnings.length > 0) {
      response.warning = warnings.join('; ');
    }

    res.json(response);
    
  } catch (err) {
    console.error('Unexpected error in contact form submission:', err);
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred. Please try again later or contact us directly at sales@sayoneventures.com'
    });
  }
});

// ================= SERVER STARTUP =================
const PORT = process.env.PORT || 3000;

// Only start the server if this file is run directly (not when imported as a module)
if (require.main === module) {
  if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      server.close(() => process.exit(1));
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });
  }
}

// Export the Express API for Vercel
module.exports = app;
