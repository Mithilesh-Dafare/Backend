const nodemailer = require('nodemailer');
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // Your full email (e.g., youremail@gmail.com)
    pass: process.env.SMTP_PASSWORD, // App Password (16 characters, no spaces)
  },
  // Additional options for better compatibility
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Function to send confirmation email
async function sendConfirmationEmail(name, email, message) {
  const mailOptions = {
    from: `"SayOne Ventures" <${process.env.SMTP_USER}>`,
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
            <p>Dear ${name},</p>
            <p>We have received your message and appreciate you taking the time to contact SayOne Ventures.</p>
            
            <div class="message-box">
              <strong>Your Message:</strong>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p>Our team will review your inquiry and get back to you within 24-48 hours. We value your interest in our premium organic millets and look forward to assisting you.</p>
            
            <p>If you have any urgent queries, please feel free to contact us directly:</p>
            <ul>
              <li>Email: info@sayoneventures.com</li>
              <li>Phone: +91-XXXXXXXXXX</li>
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
      Email: info@sayoneventures.com
      Phone: +91-XXXXXXXXXX
      
      Best regards,
      The SayOne Ventures Team
      
      © 2024 SayOne Ventures. All rights reserved.
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

async function sendAdminNotification(name, email, message) {
  if (!ADMIN_EMAIL) {
    console.warn('Admin email not configured. Skipping admin notification.');
    return { success: false, error: 'Admin email not configured' };
  }

  const mailOptions = {
    from: `"SayOne Ventures" <${process.env.SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: 'New Contact Submission - SayOne Ventures',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>New Contact Submission</h2>
        <p>A new user has submitted the contact form on the SayOne Ventures website.</p>
        <table cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="background:#f7f7f7; font-weight:bold; width: 150px;">Name</td>
            <td>${name}</td>
          </tr>
          <tr>
            <td style="background:#f7f7f7; font-weight:bold;">Email</td>
            <td>${email}</td>
          </tr>
          <tr>
            <td style="background:#f7f7f7; font-weight:bold;">Message</td>
            <td>${message.replace(/\n/g, '<br>')}</td>
          </tr>
        </table>
        <p style="margin-top:20px;">Log in to the admin dashboard or database to view more details.</p>
      </body>
      </html>
    `,
    text: `
      New Contact Submission

      Name: ${name}
      Email: ${email}

      Message:
      ${message}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendConfirmationEmail, sendAdminNotification };

