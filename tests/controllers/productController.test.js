const { ProductController } = require('../../controllers/productController')
const pool = require('../../db')
const { AppError } = require('../../middleware/errorHandler')

// S'assurer que le mock est utilisé
jest.mock('../../db')

// Réinitialiser tous les mocks avant chaque test
beforeEach(() => {
  jest.clearAllMocks()
})

describe('ProductController', () => {
  // Test de getProductById
  describe('getProductById', () => {
    it('devrait retourner un produit quand il existe', async () => {
      // Préparation : on simule un produit dans la DB
      const mockProduct = {
        id: 1,
        name: 'Test Product',
        price: 99.99
      }
      
      // On configure le mock pour retourner notre produit test
      pool.query.mockResolvedValue({
        rows: [mockProduct]
      })

      // Action : on appelle la méthode à tester
      const result = await ProductController.getProductById(1)

      // Vérifications
      expect(result).toEqual(mockProduct)
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM products WHERE id = $1',
        [1]
      )
    })

    it('devrait lancer une erreur si le produit n\'existe pas', async () => {
      // Simulation d'une DB vide
      pool.query.mockResolvedValue({
        rows: []
      })

      // On vérifie que la méthode lance bien une erreur
      await expect(ProductController.getProductById(999))
        .rejects
        .toThrow('Produit non trouvé')
    })
  })

  // Test de getAllProducts
  describe('getAllProducts', () => {
    it('devrait retourner une liste paginée de produits', async () => {
      // Préparation
      const mockProducts = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' }
      ]

      // Mock des deux requêtes (produits et count)
      pool.query
        .mockResolvedValueOnce({ rows: mockProducts }) // Première requête : liste des produits
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Deuxième requête : count total

      // Action
      const result = await ProductController.getAllProducts({
        query: { page: 1, limit: 10 }
      })

      // Vérifications
      expect(result.data).toEqual(mockProducts)
      expect(result.pagination).toEqual({
        currentPage: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1
      })
    })
  })
})