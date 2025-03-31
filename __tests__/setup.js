// Configuration globale pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Désactiver les logs pendant les tests
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.info = jest.fn();

// Nettoyer après chaque test
afterEach(() => {
    jest.clearAllMocks();
}); 