const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration
// Configure SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
    tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
    },
    debug: true, // show debug output
    logger: true // log information in console
});

// Verify SMTP connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('SMTP Connection Error:', error);
    } else {
        console.log('SMTP Server is ready to take our messages');
    }
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

// Function to validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Function to send emails
async function sendEmails(name, email, message) {
    try {
        console.log('Validating email addresses...');
        
        // Validate email addresses
        if (!isValidEmail(email)) {
            throw new Error(`Invalid recipient email: ${email}`);
        }
        
        if (!process.env.ADMIN_EMAIL || !isValidEmail(process.env.ADMIN_EMAIL)) {
            throw new Error(`Invalid admin email: ${process.env.ADMIN_EMAIL}`);
        }
        
        if (!process.env.SMTP_USER || !isValidEmail(process.env.SMTP_USER)) {
            throw new Error(`Invalid SMTP user email: ${process.env.SMTP_USER}`);
        }

        console.log('Sending email to:', email);
        console.log('SMTP Config:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE,
            hasUser: !!process.env.SMTP_USER,
            hasPassword: !!process.env.SMTP_PASSWORD,
            adminEmail: process.env.ADMIN_EMAIL
        });

        // Test the connection first
        console.log('Verifying SMTP connection...');
        try {
            await transporter.verify();
            console.log('Server is ready to take our messages');
        } catch (verifyError) {
            console.error('SMTP Connection error:', verifyError);
            throw new Error(`SMTP Connection failed: ${verifyError.message}`);
        }

        // Send confirmation to user
        console.log('Sending user confirmation email...');
        const userMail = templates.userConfirmation(name, email, message);
        
        if (!userMail.to) {
            throw new Error('No recipient email address provided for user confirmation');
        }
        
        console.log('User email details:', {
            to: userMail.to,
            subject: userMail.subject,
            from: userMail.from
        });
        
        await transporter.sendMail(userMail);
        console.log('User confirmation email sent successfully');
        
        // Send notification to admin
        console.log('Sending admin notification...');
        const adminMail = templates.adminNotification(name, email, message);
        
        if (!adminMail.to) {
            throw new Error('No recipient email address provided for admin notification');
        }
        
        console.log('Admin email details:', {
            to: adminMail.to,
            subject: adminMail.subject,
            from: adminMail.from
        });
        
        await transporter.sendMail(adminMail);
        console.log('Admin notification sent successfully');
        
        return { 
            success: true, 
            message: 'Emails sent successfully' 
        };
    } catch (error) {
        const errorDetails = {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack,
            response: error.response
        };
        
        console.error('Detailed error sending emails:', errorDetails);
        
        return { 
            success: false, 
            error: 'Failed to send emails',
            details: error.message,
            code: error.code || 'EMAIL_ERROR'
        };
    }
}

module.exports = {
    sendEmails
};
