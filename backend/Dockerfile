FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables
ENV PORT=3000
ENV DATABASE_URL=postgresql://postgres:0304@localhost:5432/eventhub_db
ENV JWT_SECRET=your_jwt_secret_key_change_in_production
ENV NODE_ENV=development

EXPOSE 3000

CMD ["npm", "start"]