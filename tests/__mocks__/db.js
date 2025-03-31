const mockQuery = jest.fn();

const pool = {
  query: mockQuery,
  end: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  connect: jest.fn(),
  release: jest.fn()
};

// Mock des requêtes
mockQuery.mockImplementation((query, params) => {
  // Pour les requêtes de liste
  if (query.includes('SELECT *, variants FROM products')) {
    return Promise.resolve({
      rows: [
        { id: 1, name: 'Product 1', price: 99.99, description: 'Test 1' },
        { id: 2, name: 'Product 2', price: 149.99, description: 'Test 2' }
      ]
    });
  }

  // Pour les requêtes de comptage
  if (query.includes('COUNT')) {
    return Promise.resolve({ rows: [{ count: '2' }] });
  }

  // Pour les requêtes de produit par ID
  if (query.includes('SELECT * FROM products WHERE id = $1')) {
    if (params[0] === 999) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({
      rows: [{
        id: params[0],
        name: 'Test Product',
        price: 99.99,
        description: 'Test description'
      }]
    });
  }

  // Pour les requêtes d'insertion
  if (query.includes('INSERT INTO products')) {
    return Promise.resolve({
      rows: [{
        id: 1,
        name: params[0],
        price: params[1],
        description: params[2]
      }]
    });
  }

  // Pour les requêtes de mise à jour
  if (query.includes('UPDATE products')) {
    if (params[params.length - 1] === 999) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({
      rows: [{
        id: params[params.length - 1],
        name: params[0] || 'Test Product',
        price: params[1] || 99.99
      }]
    });
  }

  // Pour les requêtes de suppression
  if (query.includes('DELETE FROM products')) {
    if (params[0] === 999) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({
      rows: [{
        id: params[0],
        name: 'Deleted Product'
      }]
    });
  }

  // Pour les vérifications d'existence dans les commandes
  if (query.includes('EXISTS(SELECT 1 FROM order_items')) {
    return Promise.resolve({ rows: [{ exists: false }] });
  }

  // Par défaut
  return Promise.resolve({ rows: [] });
});

module.exports = pool; 