const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  try {
    const form = new FormData();
    form.append('name', 'Test Cloudinary Product');
    form.append('price', '99.99');
    form.append('stock', '10');
    form.append('image_url', fs.createReadStream(path.join(__dirname, 'public', 'uploads', 'test-image.jpg')));

    const response = await axios.post('http://localhost:5001/api/products', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    console.log('Réponse:', response.data);
  } catch (error) {
    console.error('Erreur:', error.response?.data || error.message);
  }
}

testUpload(); 