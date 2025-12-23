// Quick Email Configuration Test
// Run this file to test your email setup: node test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing email configuration...\n');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Not set');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Not set');
console.log('SMTP_USER:', process.env.SMTP_USER || 'Not set');
console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***' + process.env.SMTP_PASSWORD.slice(-4) : 'Not set');
console.log('Password length:', process.env.SMTP_PASSWORD?.length || 0, 'characters\n');

if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
  console.log('❌ ERROR: SMTP_USER or SMTP_PASSWORD not found in .env file');
  console.log('Please add them to your .env file');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

console.log('Attempting to verify email connection...\n');

transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ CONNECTION FAILED');
    console.log('Error:', error.message);
    console.log('\nCommon issues:');
    console.log('1. Using regular password instead of App Password');
    console.log('2. App Password has spaces (remove them)');
    console.log('3. Email missing @gmail.com');
    console.log('4. 2-Factor Authentication not enabled');
    console.log('\nSee EMAIL_TROUBLESHOOTING.md for detailed fix instructions');
    process.exit(1);
  } else {
    console.log('✅ SUCCESS! Email server is ready to send messages');
    console.log('\nYour email configuration is correct!');
    console.log('You can now use the contact form on your website.');
  }
});

