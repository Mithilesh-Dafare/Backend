const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Email templates
const templates = {
    userConfirmation: (name, email, message) => ({
        from: `"${process.env.SITE_NAME || 'SayOne Ventures'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Thank You for Contacting Us',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2d5016;">Thank You for Contacting Us!</h2>
                <p>Dear ${name},</p>
                <p>We have received your message and will get back to you as soon as possible.</p>
                <p><strong>Your Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
                <p>Best regards,<br>${process.env.SITE_NAME || 'SayOne Ventures'}</p>
            </div>
        `
    }),
    adminNotification: (name, email, message) => ({
        from: `"${process.env.SITE_NAME || 'SayOne Ventures'}" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Contact Form Submission',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2d5016;">New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
                <p>Please respond to this inquiry at your earliest convenience.</p>
            </div>
        `
    })
};

// Function to send emails
async function sendEmails(name, email, message) {
    try {
        // Send confirmation to user
        await transporter.sendMail(templates.userConfirmation(name, email, message));
        
        // Send notification to admin
        await transporter.sendMail(templates.adminNotification(name, email, message));
        
        return { success: true, message: 'Emails sent successfully' };
    } catch (error) {
        console.error('Error sending emails:', error);
        return { success: false, error: 'Failed to send emails' };
    }
}

module.exports = {
    sendEmails
};
