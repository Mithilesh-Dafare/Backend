const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { body, validationResult } = require('express-validator');
const supabase = require('./config/supabase');
const { sendConfirmationEmail, sendAdminNotification } = require('./config/email');

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


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



// ================= VALIDATION =================
const validateContact = [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('message').notEmpty()
];

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
  // Set content type to HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Send the HTML response
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SayOne Ventures - Backend</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: #f5f5f5;
        }
        .container {
          text-align: center;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          max-width: 600px;
          width: 100%;
        }
        h1 {
          color: #2d5016;
          margin-bottom: 1rem;
        }
        .status {
          color: #4caf50;
          font-weight: bold;
          margin: 1rem 0;
        }
        .links {
          margin-top: 2rem;
        }
        a {
          display: inline-block;
          margin: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #2d5016;
          color: white;
          text-decoration: none;
          border-radius: 4px;
        }
        a:hover {
          background-color: #3a661e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>SayOne Ventures Backend</h1>
        <div class="status">✅ Backend is running with Supabase</div>
        <p>You're viewing the API backend server. Here are some useful links:</p>
        <div class="links">
          <a href="/admin/contacts">Admin Dashboard</a>
          <a href="https://supabase.com/dashboard" target="_blank">Supabase Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `);
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

// ========== CONTACT FORM ==========

app.post('/api/contact', validateContact, async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    console.log('Received contact form submission:', { name, email, message: message ? `${message.substring(0, 50)}...` : 'empty' });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    // Save to database
    const { data, error: dbError } = await supabase
      .from('contacts')
      .insert([{ name, email, message }])
      .select();

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if database insert fails, still try to send emails
    } else {
      console.log('Saved contact to database:', data);
    }

    // Send confirmation email to user
    const confirmationResult = await sendConfirmationEmail(name, email, message);
    if (!confirmationResult.success) {
      console.error('Failed to send confirmation email:', confirmationResult.error);
      // Continue even if confirmation email fails
    }

    // Send notification to admin
    const notificationResult = await sendAdminNotification(name, email, message);
    if (!notificationResult.success) {
      console.error('Failed to send admin notification:', notificationResult.error);
      // Continue even if admin notification fails
    }

    // If we couldn't send either email, return a warning but still success
    if (!confirmationResult.success || !notificationResult.success) {
      return res.json({ 
        success: true, 
        message: 'Message received, but there was an issue sending notifications',
        warning: 'Email notifications may not have been delivered'
      });
    }

    res.json({ 
      success: true, 
      message: 'Thank you for your message! We\'ll get back to you soon.'
    });
    
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
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
    console.log(`🔐 Admin dashboard: http://localhost:${PORT}/admin/contacts\n`);
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please free the port or specify a different port.`);
    } else {
      console.error('❌ Failed to start server:', error.message);
    }
    process.exit(1);
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

// Export the Express API for Vercel
module.exports = app;
