// Désactiver les logs pendant les tests
console.log = jest.fn()
console.error = jest.fn()

// Définir l'environnement de test
process.env.NODE_ENV = 'test'

// Mock de la base de données
jest.mock('../db', () => {
  const mockQuery = jest.fn()
  return {
    query: mockQuery,
    end: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    connect: jest.fn(),
    release: jest.fn()
  }
})

jest.setTimeout(30000);

const express = require('express');
const { AppError } = require('../middleware/errorHandler');

// Configuration de base pour tous les tests
const setupTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock de express-validator avec chaînage
  jest.mock('express-validator', () => {
    const validationChain = () => {
      const chain = (req, res, next) => next();
      chain.optional = () => chain;
      chain.isInt = () => chain;
      chain.isFloat = () => chain;
      chain.isString = () => chain;
      chain.isIn = () => chain;
      chain.isBoolean = () => chain;
      chain.notEmpty = () => chain;
      chain.withMessage = () => chain;
      return chain;
    };

    return {
      body: validationChain,
      query: validationChain,
      param: validationChain,
      validationResult: () => ({
        isEmpty: () => true,
        array: () => []
      })
    };
  });

  // Middleware d'erreur global
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        status: 'error',
        message: err.message
      });
    }
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal Server Error'
    });
  });

  return app;
};

module.exports = { setupTestApp };