const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../config/mailer');

router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  try {
    await sendContactMessage({ name, email, message });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur envoi mail contact:', error);
    res.status(500).json({ error: "Erreur lors de l'envoi du message" });
  }
});

module.exports = router; 