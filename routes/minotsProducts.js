const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const uploadFields = require("../middleware/upload");
// À adapter selon ton architecture
const { MinotsProductController } = require("../controllers/minotsProductController");

// POST minots
router.post("/", authMiddleware, uploadFields, async (req, res, next) => {
  try {
    const product = await MinotsProductController.createMinotsProduct(req.body, req.files);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PUT minots
router.put("/:id", authMiddleware, uploadFields, async (req, res, next) => {
  try {
    const product = await MinotsProductController.updateMinotsProduct(req.params.id, req.body, req.files);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router; 