const nodemailer = require("nodemailer");
require("dotenv").config();

// Email configuration
// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false,
  },
  debug: true, // show debug output
  logger: true, // log information in console
});

// Verify SMTP connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take our messages");
  }
});

// Email templates
const templates = {
  userConfirmation: (contactData) => ({
    from: `"${process.env.SITE_NAME || "SayOne Ventures"}" <${process.env.SMTP_USER}>`,
    to: contactData.email,
    subject: "Thank You for Contacting Us",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2d5016;">Thank You for Contacting Us!</h2>
                <p>Dear ${contactData.name},</p>
                <p>We have received your message and will get back to you as soon as possible.</p>
                ${contactData.message ? `<p><strong>Your Message:</strong><br>${contactData.message.replace(/\n/g, "<br>")}</p>` : ""}
                <p>Best regards,<br>${process.env.SITE_NAME || "SayOne Ventures"}</p>
            </div>
        `,
  }),
  adminNotification: (contactData) => ({
    from: `"${process.env.SITE_NAME || "SayOne Ventures"}" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: "New Contact Form Submission",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2d5016;">New Contact Form Submission</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold; width: 150px;">Name:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;">${contactData.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;"><a href="mailto:${contactData.email}">${contactData.email}</a></td>
                    </tr>
                    ${
                      contactData.phone
                        ? `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold;">WhatsApp Number:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;">${contactData.phone}</td>
                    </tr>
                    `
                        : ""
                    }
                    ${
                      contactData.country
                        ? `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold;">Country:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;">${contactData.country}</td>
                    </tr>
                    `
                        : ""
                    }
                    ${
                      contactData.organization
                        ? `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold;">Organization:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;">${contactData.organization}</td>
                    </tr>
                    `
                        : ""
                    }
                    ${
                      contactData.role
                        ? `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; font-weight: bold;">Role:</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd;">${contactData.role}</td>
                    </tr>
                    `
                        : ""
                    }
                </table>
                ${contactData.message ? `<p><strong>Message:</strong><br>${contactData.message.replace(/\n/g, "<br>")}</p>` : ""}
                <p style="margin-top: 2rem; color: #666;">Please respond to this inquiry at your earliest convenience.</p>
            </div>
        `,
  }),
};

// Function to validate email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Function to send emails
async function sendEmails(contactData) {
  try {
    console.log("Validating email addresses...");

    // Validate email addresses
    if (!isValidEmail(contactData.email)) {
      throw new Error(`Invalid recipient email: ${contactData.email}`);
    }

    if (!process.env.ADMIN_EMAIL || !isValidEmail(process.env.ADMIN_EMAIL)) {
      throw new Error(`Invalid admin email: ${process.env.ADMIN_EMAIL}`);
    }

    if (!process.env.SMTP_USER || !isValidEmail(process.env.SMTP_USER)) {
      throw new Error(`Invalid SMTP user email: ${process.env.SMTP_USER}`);
    }

    console.log("Sending email to:", contactData.email);
    console.log("SMTP Config:", {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      hasUser: !!process.env.SMTP_USER,
      hasPassword: !!process.env.SMTP_PASSWORD,
      adminEmail: process.env.ADMIN_EMAIL,
    });

    // Test the connection first
    console.log("Verifying SMTP connection...");
    try {
      await transporter.verify();
      console.log("Server is ready to take our messages");
    } catch (verifyError) {
      console.error("SMTP Connection error:", verifyError);
      throw new Error(`SMTP Connection failed: ${verifyError.message}`);
    }

    // Send confirmation to user
    console.log("Sending user confirmation email...");
    const userMail = templates.userConfirmation(contactData);

    if (!userMail.to) {
      throw new Error(
        "No recipient email address provided for user confirmation",
      );
    }

    console.log("User email details:", {
      to: userMail.to,
      subject: userMail.subject,
      from: userMail.from,
    });

    await transporter.sendMail(userMail);
    console.log("User confirmation email sent successfully");

    // Send notification to admin
    console.log("Sending admin notification...");
    const adminMail = templates.adminNotification(contactData);

    if (!adminMail.to) {
      throw new Error(
        "No recipient email address provided for admin notification",
      );
    }

    console.log("Admin email details:", {
      to: adminMail.to,
      subject: adminMail.subject,
      from: adminMail.from,
    });

    await transporter.sendMail(adminMail);
    console.log("Admin notification sent successfully");

    return {
      success: true,
      message: "Emails sent successfully",
    };
  } catch (error) {
    const errorDetails = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response,
    };

    console.error("Detailed error sending emails:", errorDetails);

    return {
      success: false,
      error: "Failed to send emails",
      details: error.message,
      code: error.code || "EMAIL_ERROR",
    };
  }
}

module.exports = {
  sendEmails,
};
