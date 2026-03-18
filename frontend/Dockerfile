# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Build args - EasyPanel los inyecta en tiempo de build
ARG REACT_APP_BACKEND_URL=https://julio-dentu-backend.zhwiib.easypanel.host
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

ARG REACT_APP_GOOGLE_CLIENT_ID=303856164144-86ob8fahvthq9vtq2nltadl7dl0romb0.apps.googleusercontent.com
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

ARG REACT_APP_GOOGLE_API_KEY=AIzaSyDO85kjikf16LgQuhz_cx4GvgvxKV4_c5A
ENV REACT_APP_GOOGLE_API_KEY=$REACT_APP_GOOGLE_API_KEY

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: serve con nginx
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
