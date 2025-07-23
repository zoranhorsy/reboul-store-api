const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const uploadFields = require("../middleware/upload");
// À adapter selon ton architecture
const { SneakersProductController } = require("../controllers/sneakersProductController");

// POST sneakers
router.post("/", authMiddleware, uploadFields, async (req, res, next) => {
  try {
    const product = await SneakersProductController.createSneakersProduct(req.body, req.files);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PUT sneakers
router.put("/:id", authMiddleware, uploadFields, async (req, res, next) => {
  try {
    const product = await SneakersProductController.updateSneakersProduct(req.params.id, req.body, req.files);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router; 