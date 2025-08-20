// Récupérer toutes les collections actives du carousel
const getCollectionsCarousel = async (req, res) => {
  try {
    res.json({
      success: true,
      data: [
        {
          id: 1,
          name: "Collection CP Company",
          description: "Design italien - Les essentiels CP Company",
          image_url: "/images/collections/cp-company.jpg",
          link_url: "/catalogue?brand=cp-company",
          badge: "Tendance",
          sort_order: 1
        }
      ]
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des collections carousel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des collections'
    });
  }
};

// Récupérer une collection par ID
const getCollectionById = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Fonction temporairement désactivée'
  });
};

// Créer une nouvelle collection
const createCollection = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Fonction temporairement désactivée'
  });
};

// Mettre à jour une collection
const updateCollection = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Fonction temporairement désactivée'
  });
};

// Supprimer une collection (soft delete)
const deleteCollection = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Fonction temporairement désactivée'
  });
};

// Réorganiser l'ordre des collections
const reorderCollections = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Fonction temporairement désactivée'
  });
};

module.exports = {
  getCollectionsCarousel,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  reorderCollections
};
