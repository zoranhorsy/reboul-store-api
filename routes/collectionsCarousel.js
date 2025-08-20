const express = require('express');
const router = express.Router();

// Test simple
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: "Test Collection",
        description: "Test",
        image_url: "/test.jpg",
        link_url: "/test",
        badge: "Test",
        sort_order: 1
      }
    ]
  });
});

module.exports = router;
