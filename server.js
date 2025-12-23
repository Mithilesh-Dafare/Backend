const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { body, validationResult } = require('express-validator');
const supabase = require('./config/supabase');
const Razorpay = require('razorpay');
const { sendConfirmationEmail, sendAdminNotification } = require('./config/email');

const app = express();

// =================== CONFIG ===================

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const isProduction = process.env.NODE_ENV === 'production';

// ================= MIDDLEWARE =================

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In production, serve static files from the frontend/dist directory
if (isProduction) {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Handle SPA (Single Page Application) routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // In development, serve static files from the frontend/public directory
  app.use(express.static(path.join(__dirname, '../frontend/public')));
}

// ================= RAZORPAY ==================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ================= VALIDATION =================

const validateOrder = [
  body('name').notEmpty(),
  body('phone').notEmpty(),
  body('email').isEmail(),
  body('address').notEmpty(),
  body('city').notEmpty(),
  body('country').notEmpty(),
  body('postalCode').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('totalAmount').isFloat({ min: 0 })
];

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

// ========== CREATE RAZORPAY ORDER ==========

app.post('/api/create-order', validateOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(errors.array());

    const amount = Math.round(req.body.totalAmount * 100);

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `order_${Date.now()}`
    });

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// ========== VERIFY PAYMENT & SAVE ORDER ==========

app.post('/api/verify-payment', validateOrder, async (req, res) => {
  try {
    const {
      name, phone, email, address, city, country, postalCode,
      items, totalAmount, paymentId
    } = req.body;

    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status !== 'captured') {
      return res.status(400).json({ error: 'Payment not captured' });
    }

    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .insert([{ name, phone, email, address, city, country, postal_code: postalCode }])
      .select()
      .single();

    if (cErr) throw cErr;

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert([{ customer_id: customer.id, total_amount: totalAmount, payment_status: 'completed', payment_id: paymentId }])
      .select()
      .single();

    if (oErr) throw oErr;

    for (const item of items) {
      await supabase.from('order_items').insert([{
        order_id: order.id,
        millet_name: item.milletName,
        quantity: item.quantity,
        per_unit_price: item.price,
        amount: item.quantity * item.price
      }]);
    }

    res.json({ success: true, orderId: order.id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ========== CONTACT FORM ==========

app.post('/api/contact', validateContact, async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const { error } = await supabase
      .from('contacts')
      .insert([{ name, email, message }]);

    if (error) throw error;

    await sendConfirmationEmail(name, email, message);
    await sendAdminNotification(name, email, message);

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Contact failed' });
  }
});

// ================= SERVER STARTUP =================
const PORT = process.env.PORT || 3000;

// Only start the server if this file is run directly (not when imported as a module)
if (require.main === module) {
  // Ensure environment variables are loaded
  require('dotenv').config();
  
  // Start the server
  app.listen(PORT, '0.0.0.0', () => {
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
}

module.exports = app;
