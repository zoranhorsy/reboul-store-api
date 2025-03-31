// controllers/categoryController.js
const pool = require('../db');
const { AppError } = require('../middleware/errorHandler');

class CategoryController {
  static async getAllCategories(req, res, next) {
    try {
      const result = await pool.query('SELECT * FROM categories ORDER BY name');
      res.json(result.rows);
    } catch (err) {
      next(new AppError('Erreur lors de la récupération des catégories', 500));
    }
  }

  static async getCategoryById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return next(new AppError('Catégorie non trouvée', 404));
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(new AppError('Erreur lors de la récupération de la catégorie', 500));
    }
  }

  static async createCategory(req, res, next) {
    try {
      const { name } = req.body;
      if (!name) {
        return next(new AppError('Le nom de la catégorie est requis', 400));
      }
      const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(new AppError('Erreur lors de la création de la catégorie', 500));
    }
  }

  static async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name) {
        return next(new AppError('Le nom de la catégorie est requis', 400));
      }
      const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) {
        return next(new AppError('Catégorie non trouvée', 404));
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(new AppError('Erreur lors de la mise à jour de la catégorie', 500));
    }
  }

  static async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return next(new AppError('Catégorie non trouvée', 404));
      }
      res.json({ message: 'Catégorie supprimée avec succès' });
    } catch (err) {
      next(new AppError('Erreur lors de la suppression de la catégorie', 500));
    }
  }
}

module.exports = CategoryController;