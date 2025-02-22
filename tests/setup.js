// Configuration globale pour les tests
process.env.NODE_ENV = 'test'

// Augmenter le timeout par défaut
jest.setTimeout(30000)

// Mock de la base de données pour éviter d'utiliser la vraie DB pendant les tests
jest.mock('../db', () => ({
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(true)
}))