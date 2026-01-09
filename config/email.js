const nodemailer = require('nodemailer');
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;

// Validate required environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Email functionality will be disabled');
}

// Create transporter with retry logic
let transporter;
let emailEnabled = missingVars.length === 0;

if (emailEnabled) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Add connection timeout
    connectionTimeout: 10000, // 10 seconds
    // Add socket timeout
    socketTimeout: 10000, // 10 seconds
    // Don't fail on invalid certificates
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production' // Only validate certs in production
    }
  });

  // Verify transporter configuration
  transporter.verify(function (error) {
    if (error) {
      console.error('Email configuration error:', error);
      emailEnabled = false;
    } else {
      console.log('Email server is ready to send messages');
    }
  });
} else {
  console.warn('Email service is disabled due to missing configuration');
}

// Function to safely send email with retry logic
async function sendEmailWithRetry(mailOptions, maxRetries = 2) {
  if (!emailEnabled) {
    console.warn('Email service is disabled, not sending email');
    return { success: false, error: 'Email service is disabled' };
  }

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending email (attempt ${attempt}/${maxRetries}) to ${mailOptions.to}`);
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Email send attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, etc.
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('All email send attempts failed');
  return { 
    success: false, 
    error: lastError?.message || 'Failed to send email after multiple attempts' 
  };
}

// Function to send confirmation email
async function sendConfirmationEmail(name, email, message) {
  if (!emailEnabled) {
    console.warn('Email service is disabled, not sending confirmation email');
    return { success: false, error: 'Email service is disabled' };
  }

  const mailOptions = {
    from: `"SayOne Ventures" <${process.env.SMTP_USER || 'noreply@sayoneventures.com'}>`,
    to: email,
    subject: 'Thank You for Contacting SayOne Ventures',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            background-color: #2d5016;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 5px 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
          .message-box {
            background-color: #f0f8e8;
            border-left: 4px solid #2d5016;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SayOne Ventures</h1>
            <p>Premium Organic Millets</p>
          </div>
          <div class="content">
            <h2>Thank You for Contacting Us!</h2>
            <p>Dear ${name || 'Valued Customer'},</p>
            <p>We have received your message and appreciate you taking the time to contact SayOne Ventures.</p>
            
            ${message ? `
            <div class="message-box">
              <strong>Your Message:</strong>
              <p>${String(message).replace(/\n/g, '<br>')}</p>
            </div>` : ''}
            
            <p>Our team will review your inquiry and get back to you within 24-48 hours. We value your interest in our premium organic millets and look forward to assisting you.</p>
            
            <p>If you have any urgent queries, please feel free to contact us directly:</p>
            <ul>
              <li>Email: sales@sayoneventures.com</li>
              <li>Phone: +91-7058766180</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>The SayOne Ventures Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 SayOne Ventures. All rights reserved.</p>
            <p>This is an automated confirmation email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Thank You for Contacting SayOne Ventures!
      
      Dear ${name},
      
      We have received your message and appreciate you taking the time to contact SayOne Ventures.
      
      Your Message:
      ${message}
      
      Our team will review your inquiry and get back to you within 24-48 hours. We value your interest in our premium organic millets and look forward to assisting you.
      
      If you have any urgent queries, please feel free to contact us directly:
      Email: sales@sayoneventures.com
      Phone: +91-7058766180
      
      Best regards,
      The SayOne Ventures Team
      
      © 2025 SayOne Ventures. All rights reserved.
      This is an automated confirmation email. Please do not reply to this email.
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
}

// Function to send admin notification
async function sendAdminNotification(name, email, message) {
  if (!emailEnabled) {
    console.warn('Email service is disabled, not sending admin notification');
    return { success: false, error: 'Email service is disabled' };
  }

  if (!ADMIN_EMAIL) {
    console.warn('No admin email configured, not sending admin notification');
    return { success: false, error: 'No admin email configured' };
  }

  const mailOptions = {
    from: `"SayOne Ventures Contact Form" <${process.env.SMTP_USER || 'noreply@sayoneventures.com'}>`,
    to: ADMIN_EMAIL,
    subject: `New Contact Form Submission from ${name || 'a visitor'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            margin: 0;
            padding: 0;
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
          }
          .header { 
            background-color: #2d5016; 
            color: white; 
            padding: 20px; 
            text-align: center; 
          }
          .content { 
            padding: 25px; 
            background-color: #fff;
          }
          .footer { 
            margin-top: 20px; 
            padding-top: 15px;
            border-top: 1px solid #eee;
            font-size: 12px; 
            color: #777; 
            text-align: center; 
          }
          .message-box {
            background-color: #f8f9fa;
            border-left: 4px solid #2d5016;
            padding: 12px 15px;
            margin: 15px 0;
            font-family: monospace;
            white-space: pre-wrap;
          }
          .label {
            font-weight: bold;
            color: #2d5016;
            display: inline-block;
            min-width: 80px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">New Contact Form Submission</h2>
          </div>
          <div class="content">
            <p><span class="label">Name:</span> ${name || 'Not provided'}</p>
            <p><span class="label">Email:</span> <a href="mailto:${email}">${email || 'Not provided'}</a></p>
            <p><span class="label">Time:</span> ${new Date().toLocaleString()}</p>
            
            <div class="message-box">
              ${message ? String(message).replace(/\n/g, '<br>') : 'No message provided'}
            </div>
            
            <div class="footer">
              <p>This is an automated message. Please respond to the sender directly.</p>
              <p>This email was sent from the contact form on SayOne Ventures website.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      New Contact Form Submission

      Name: ${name || 'Not provided'}
      Email: ${email || 'Not provided'}
      Time: ${new Date().toLocaleString()}

      ${message ? String(message) : 'No message provided'}

      This is an automated message. Please respond to the sender directly.
      This email was sent from the contact form on SayOne Ventures website.
    `
  };

  return sendEmailWithRetry(mailOptions);
}

