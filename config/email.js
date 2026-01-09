const nodemailer = require('nodemailer');
require('dotenv').config();

// Constants
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
const SITE_NAME = 'SayOne Ventures';
const SITE_EMAIL = process.env.SMTP_USER || 'noreply@sayoneventures.com';
const SITE_URL = process.env.SITE_URL || 'https://www.sayoneventures.com';

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
    connectionTimeout: 10000, // 10 seconds
    socketTimeout: 10000, // 10 seconds
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

/**
 * Send a confirmation email to the user who submitted the contact form
 * @param {string} name - User's name
 * @param {string} email - User's email address
 * @param {string} message - User's message
 * @returns {Promise<Object>} Result of the email sending attempt
 */
async function sendConfirmationEmail(name, email, message) {
  if (!emailEnabled) {
    console.warn('Email service is disabled, not sending confirmation email');
    return { success: false, error: 'Email service is disabled' };
  }

  const mailOptions = {
    from: `"${SITE_NAME}" <${SITE_EMAIL}>`,
    to: email,
    subject: `Thank You for Contacting ${SITE_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #2d5016; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .message-box { background-color: #f0f8e8; border-left: 4px solid #2d5016; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${SITE_NAME}</h1>
            <p>Premium Organic Millets</p>
          </div>
          <div class="content">
            <h2>Thank You for Contacting Us!</h2>
            <p>Dear ${name || 'Valued Customer'},</p>
            <p>We have received your message and appreciate you taking the time to contact us.</p>
            
            ${message ? `
            <div class="message-box">
              <strong>Your Message:</strong>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>` : ''}
            
            <p>Our team will review your inquiry and get back to you within 24-48 hours. We value your interest in our premium organic millets and look forward to assisting you.</p>
            
            <p>If you have any urgent queries, please feel free to contact us directly:</p>
            <ul>
              <li>Email: sales@sayoneventures.com</li>
              <li>Phone: +91-7058766180</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>The ${SITE_NAME} Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</p>
            <p>This is an automated confirmation email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Thank You for Contacting ${SITE_NAME}!
      
      Dear ${name || 'Valued Customer'},
      
      We have received your message and appreciate you taking the time to contact us.
      
      Your Message:
      ${message}
      
      Our team will review your inquiry and get back to you within 24-48 hours. We value your interest in our premium organic millets and look forward to assisting you.
      
      If you have any urgent queries, please feel free to contact us directly:
      Email: sales@sayoneventures.com
      Phone: +91-7058766180
      
      Best regards,
      The ${SITE_NAME} Team
      
      © ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.
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

/**
 * Send a notification email to the admin about a new contact form submission
 * @param {string} name - User's name
 * @param {string} email - User's email address
 * @param {string} message - User's message
 * @returns {Promise<Object>} Result of the email sending attempt
 */
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
    from: `"${SITE_NAME} Contact Form" <${SITE_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New Contact Form Submission from ${name || 'a visitor'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
          .header { background-color: #2d5016; color: white; padding: 20px; text-align: center; }
          .content { padding: 25px; background-color: #fff; }
          .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; }
          .message-box { background-color: #f8f9fa; border-left: 4px solid #2d5016; padding: 12px 15px; margin: 15px 0; font-family: monospace; white-space: pre-wrap; }
          .label { font-weight: bold; color: #2d5016; display: inline-block; min-width: 80px; }
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
              ${message ? message.replace(/\n/g, '<br>') : 'No message provided'}
            </div>
            
            <div class="footer">
              <p>This is an automated message. Please respond to the sender directly.</p>
              <p>This email was sent from the contact form on ${SITE_NAME} website.</p>
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

      Message:
      ${message || 'No message provided'}

      This is an automated message. Please respond to the sender directly.
      This email was sent from the contact form on ${SITE_NAME} website.
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin notification sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, error: error.message };
  }
}

// Test email function
async function sendTestEmail() {
  if (!emailEnabled) {
    const error = new Error('Email service is disabled due to missing or invalid configuration');
    error.missingVars = missingVars;
    throw error;
  }

  const testEmail = {
    from: `"${SITE_NAME} Test" <${SITE_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `[${SITE_NAME}] Test Email`,
    text: `This is a test email sent from ${SITE_NAME} at ${new Date().toISOString()}`,
    html: `
      <h1>Test Email from ${SITE_NAME}</h1>
      <p>This is a test email sent at ${new Date().toLocaleString()}</p>
      <p>If you're seeing this, your email configuration is working correctly!</p>
    `
  };

  try {
    const info = await transporter.sendMail(testEmail);
    return {
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER
      }
    };
  } catch (error) {
    console.error('Test email failed:', error);
    return {
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER ? '*****' : undefined
      }
    };
  }
}

module.exports = {
  sendConfirmationEmail,
  sendAdminNotification,
  sendTestEmail
};
