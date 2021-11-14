#General Server Setup
#Prepares server to host multiple sites. Does not actually add the site.
#Running this multiple times should be entirely safe (though would be a waste of bandwidth and time, and should be avoided)

#Install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null


sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io


#Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose


#Setup websites directory:
sudo mkdir /srv/www
sudo mkdir /srv/www/nginx-proxy

pushd /srv/www/nginx-proxy

sudo mkdir conf.d
sudo mkdir vhost.d
sudo mkdir html
sudo mkdir certs

sudo tee -a docker-compose.yml > /dev/null << EOF
version: '3.6'
services:
  nginx:
    image: nginx
    labels:
      com.github.jrcs.letsencrypt_nginx_proxy_companion.nginx_proxy: "true"
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./conf.d:/etc/nginx/conf.d
      - ./vhost.d:/etc/nginx/vhost.d
      - ./html:/usr/share/nginx/html
      - ./certs:/etc/nginx/certs:ro

  nginx-gen:
    image: jwilder/docker-gen
    command: -notify-sighup nginx -watch -wait 5s:30s /etc/docker-gen/templates/nginx.tmpl /etc/nginx/conf.d/default.conf
    container_name: nginx-gen
    restart: unless-stopped
    volumes:
      - ./conf.d:/etc/nginx/conf.d
      - ./vhost.d:/etc/nginx/vhost.d
      - ./html:/usr/share/nginx/html
      - ./certs:/etc/nginx/certs:ro
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - ./nginx.tmpl:/etc/docker-gen/templates/nginx.tmpl:ro

  nginx-proxy-acme:
    image: nginxproxy/acme-companion
    container_name: nginx-proxy-acme
    restart: unless-stopped
    volumes:
      - ./conf.d:/etc/nginx/conf.d
      - ./vhost.d:/etc/nginx/vhost.d
      - ./html:/usr/share/nginx/html
      - ./certs:/etc/nginx/certs:rw
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - acme:/etc/acme.sh
    environment:
      NGINX_DOCKER_GEN_CONTAINER: "nginx-gen"
      NGINX_PROXY_CONTAINER: "nginx"

networks:
  default:
    external:
      name: nginx-proxy

volumes:
    acme:
EOF

curl https://raw.githubusercontent.com/jwilder/nginx-proxy/master/nginx.tmpl | sudo tee nginx.tmpl > /dev/null

#Setup proxy
sudo docker network create nginx-proxy
sudo docker-compose up -d

#Setup crontab to start server on reboot.
(crontab -l ; echo "@reboot pushd /srv/www/nginx-proxy && sudo docker-compose up -d") | sort - | uniq - | crontab -
