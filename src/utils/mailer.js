// utils/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const {MAILER_HOST, MAILER_PORT, MAILER_USER, MAILER_PASS} = process.env;

const transporter = nodemailer.createTransport({
    host: MAILER_HOST,       // ton SMTP (ou Gmail)
    port: MAILER_PORT,
    secure: false,
    auth: {
        user: MAILER_USER,
        pass: MAILER_PASS,
    },
});

const sendMail = async (to, subject, text) => {
    await transporter.sendMail({
        from: 'labbejoshuainfo@gmail.com',
        to: 'labbejoshuainfo@gmail.com',
        subject: subject,
        text: text,
    });
};

module.exports = { sendMail };
