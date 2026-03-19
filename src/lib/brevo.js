const { BrevoClient } = require("@getbrevo/brevo");

const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

async function sendEmail({ to, subject, htmlContent }) {
    return client.transactionalEmails.sendTransacEmail({
        sender: {
            name: process.env.BREVO_SENDER_NAME,
            email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
    });
}

async function sendOtpEmail(email, otp, purpose) {
    const titles = {
        verify: {
            subject: "Verify your Connect Social account",
            heading: "Verify your email",
            description:
                "Use the code below to verify your email address and activate your account.",
        },
        reset: {
            subject: "Reset your password - Connect Social",
            heading: "Reset your password",
            description:
                "We received a request to reset your password. Use the code below to create a new one.",
        },
    };
    const { subject, heading, description } = titles[purpose] || titles.verify;

    return sendEmail({
        to: email,
        subject,
        htmlContent: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #137fec; font-size: 24px;">Connect Social</h1>
        </div>
        <h2 style="color: #1e293b;">${heading}</h2>
        <p style="color: #64748b;">${description}</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; display: inline-block;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #137fec;">${otp}</span>
          </div>
        </div>
        <p style="color: #64748b; text-align: center; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #ef4444; text-align: center; font-size: 12px; margin-top: 16px;">Do not share this code with anyone.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    });
}

async function sendVerificationEmail(email, otp) {
    return sendOtpEmail(email, otp, "verify");
}

async function sendResetPasswordEmail(email, otp) {
    return sendOtpEmail(email, otp, "reset");
}

module.exports = {
    sendEmail,
    sendOtpEmail,
    sendVerificationEmail,
    sendResetPasswordEmail,
};
