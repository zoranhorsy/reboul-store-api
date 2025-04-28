# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p \
    public/uploads \
    public/brands \
    public/archives \
    public/placeholders

# Set permissions
RUN chmod -R 755 public

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]