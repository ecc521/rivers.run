sudo mkdir /srv/www
pushd /srv/www
sudo git clone https://github.com/ecc521/rivers.run.git

echo "Is the server already set up for multiple sites? If No, setup will be performed. "
select yn in "Yes" "No"; do
    case $yn in
        No ) ./server-setup.sh; break;;
        Yes ) break;;
    esac
done

pushd rivers.run

#These two directories are mounted as volumes.
sudo mkdir server/logs
sudo mkdir -p server/data/logs

sudo docker build -t rivers.run .
sudo docker-compose up -d
