FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf

# Default placeholder if dist is mounted or copied
RUN rm -rf /usr/share/nginx/html/*

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
