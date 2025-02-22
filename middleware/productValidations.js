const { body, param, query } = require('express-validator');

const productValidations = {
  getProducts: [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("category_id").optional().isInt(),
    query("brand").optional().isString(),
    query("minPrice").optional().isFloat({ min: 0 }),
    query("maxPrice").optional().isFloat({ min: 0 }),
    query("color").optional().isString(),
    query("size").optional().isString(),
    query("store_type").optional().isIn(["adult", "kids", "sneakers", "cpcompany"]),
    query("featured").optional().isBoolean(),
    query("search").optional().isString(),
    query("sort").optional().isIn(["name", "price"]),
    query("order").optional().isIn(["asc", "desc"])
  ],
  // ... autres validations ...
};

module.exports = productValidations; 