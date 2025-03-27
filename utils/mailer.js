const nodemailer = require("nodemailer");
require("dotenv").config();


const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to:to,
      subject:subject,
      text:text,
    };

    await transporter.sendMail(mailOptions);
    console.log(` Email sent successfully to ${to}`);
  } catch (error) {
    console.error(" Error sending email:", error);
  }
};

module.exports = sendEmail;
