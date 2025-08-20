// const pool = require('../config/database');

// Récupérer toutes les collections actives du carousel
const getCollectionsCarousel = async (req, res) => {
  try {
    // Données de test temporaires
    const testData = [
      {
        id: 1,
        name: "Collection CP Company",
        description: "Design italien - Les essentiels CP Company",
        image_url: "/images/collections/cp-company.jpg",
        link_url: "/catalogue?brand=cp-company",
        badge: "Tendance",
        sort_order: 1
      },
      {
        id: 2,
        name: "Collection Sneakers",
        description: "Les dernières nouveautés en sneakers",
        image_url: "/images/collections/sneakers-collection.jpg",
        link_url: "/catalogue?category=sneakers",
        badge: "Nouveau",
        sort_order: 2
      },
      {
        id: 3,
        name: "Collection Adultes",
        description: "Élégance contemporaine pour adultes",
        image_url: "/images/collections/adult-collection.jpg",
        link_url: "/catalogue?category=adult",
        badge: "Populaire",
        sort_order: 3
      },
      {
        id: 4,
        name: "Collection Kids",
        description: "Style et confort pour les plus jeunes",
        image_url: "/images/collections/kids-collection.jpg",
        link_url: "/catalogue?category=kids",
        badge: "Exclusif",
        sort_order: 4
      }
    ];
    
    res.json({
      success: true,
      data: testData
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
  try {
    const { id } = req.params;
    
    // Données de test temporaires
    const testData = [
      {
        id: 1,
        name: "Collection CP Company",
        description: "Design italien - Les essentiels CP Company",
        image_url: "/images/collections/cp-company.jpg",
        link_url: "/catalogue?brand=cp-company",
        badge: "Tendance",
        sort_order: 1
      },
      {
        id: 2,
        name: "Collection Sneakers",
        description: "Les dernières nouveautés en sneakers",
        image_url: "/images/collections/sneakers-collection.jpg",
        link_url: "/catalogue?category=sneakers",
        badge: "Nouveau",
        sort_order: 2
      },
      {
        id: 3,
        name: "Collection Adultes",
        description: "Élégance contemporaine pour adultes",
        image_url: "/images/collections/adult-collection.jpg",
        link_url: "/catalogue?category=adult",
        badge: "Populaire",
        sort_order: 3
      },
      {
        id: 4,
        name: "Collection Kids",
        description: "Style et confort pour les plus jeunes",
        image_url: "/images/collections/kids-collection.jpg",
        link_url: "/catalogue?category=kids",
        badge: "Exclusif",
        sort_order: 4
      }
    ];
    
    const collection = testData.find(c => c.id === parseInt(id));
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: collection
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la collection'
    });
  }
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
