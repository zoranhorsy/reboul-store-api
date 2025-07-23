const db = require('../db');

exports.MinotsProductController = {
  async createMinotsProduct(data, files) {
    // Insertion simple, à adapter selon les besoins
    const { name, price, description, category_id, brand_id, brand, image_url, images, variants, tags, details, featured, active, new: isNew, sku, store_reference, material, weight, dimensions } = data;
    const result = await db.query(
      `INSERT INTO minots_products (name, price, description, category_id, brand_id, brand, image_url, images, variants, tags, details, featured, active, new, sku, store_reference, material, weight, dimensions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [name, price, description, category_id, brand_id, brand, image_url, images, variants, tags, details, featured, active, isNew, sku, store_reference, material, weight, dimensions]
    );
    return result.rows[0];
  },

  async updateMinotsProduct(id, data, files) {
    // Update simple, à adapter selon les besoins
    const fields = [];
    const values = [];
    let idx = 1;
    for (const key in data) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
    values.push(id);
    const result = await db.query(
      `UPDATE minots_products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  }
}; 