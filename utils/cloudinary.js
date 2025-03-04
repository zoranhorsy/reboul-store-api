const cloudinary = require('cloudinary').v2;

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload une image vers Cloudinary
const uploadToCloudinary = async (file) => {
  try {
    console.log('Début uploadToCloudinary');
    console.log('File reçu:', file);
    console.log('Chemin du fichier:', file.path);

    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'reboul-store/products',
      use_filename: true,
      unique_filename: true,
    });
    
    console.log('Résultat upload Cloudinary:', result);
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Erreur Cloudinary détaillée:', error);
    throw error;
  }
};

// Supprimer une image de Cloudinary
const deleteFromCloudinary = async (public_id) => {
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error('Erreur lors de la suppression Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
}; 