const { AppError } = require('../../../middleware/errorHandler');

const ProductController = {
  getAllProducts: jest.fn().mockResolvedValue({
    data: [{ id: 1, name: 'Test Product', price: 99.99 }],
    pagination: { currentPage: 1, totalPages: 1 }
  }),

  getProductById: jest.fn().mockImplementation(async (id) => {
    if (id === '999') {
      throw new AppError('Produit non trouvé', 404);
    }
    return { id: 1, name: 'Test Product', price: 99.99 };
  }),

  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn()
};

module.exports = { ProductController };