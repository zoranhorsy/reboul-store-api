FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p public/uploads public/placeholders
RUN npm run init-uploads
EXPOSE 5001
CMD ["npm", "start"]