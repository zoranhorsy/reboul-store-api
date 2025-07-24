const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Configurer le transporteur nodemailer (utilise les variables d'env SMTP_*)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  try {
    await transporter.sendMail({
      from: `Contact Reboul <${process.env.SMTP_USER}>`,
      to: 'horsydevservices@gmail.com',
      subject: `Nouveau message de contact de ${name}`,
      text: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      replyTo: email,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur envoi mail contact:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

module.exports = router; 