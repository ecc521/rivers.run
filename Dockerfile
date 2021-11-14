FROM node:slim

RUN apt-get update
RUN apt-get upgrade -y

WORKDIR /rivers.run
COPY . .

#Install npm modules
RUN npm install --only=prod

CMD node server/usgscache.js

EXPOSE 8080
