pushd /srv/www
sudo git clone https://github.com/ecc521/rivers.run.git

echo "Is the server already set up for multiple sites?"
select yn in "Yes" "No"; do
    case $yn in
        No ) ./server-setup.sh; break;;
        Yes ) exit;;
    esac
done

pushd rivers.run

#These two directories are mounted as volumes. 
mkdir server/logs
mkdir -p server/data/logs

sudo docker build -t rivers.run .
sudo docker-compose up -d
