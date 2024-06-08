import nodemailer from 'nodemailer';

// Function to send mail to the requested email using SMTP

export async function sendMail(email: string, subject: string, text: string) {
  let message = {};
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Boolean(process.env.SMTP_SECURE) || true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text,
    });
    message = {
      id: info.messageId,
      status: info.response,
    };
    console.log(`Message sent: ${info.messageId}`);
    return message;
  } catch (error) {
    message = {
      // @ts-ignore
      error: error.message,
    };
    // @ts-ignore
    console.error(`Error: ${error.message}`);

    return message;
  }
}
