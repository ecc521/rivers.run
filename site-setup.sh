#Run in bash!
sudo mkdir /srv/www
pushd /srv/www

sudo apt-get install -y git
sudo git clone https://github.com/ecc521/rivers.run.git

pushd rivers.run

echo "Is the server already set up for multiple sites? If No, setup will be performed. "
select yn in "Yes" "No"; do
    case $yn in
        No ) bash server-setup.sh; break;;
        Yes ) break;;
    esac
done

sudo docker build -t rivers.run .
sudo docker compose up -d

echo "You should create gmailpassword.txt in server/data/notifications - simply fill in the password in the below command: "
echo "echo -n \"password\" | sudo tee $PWD/server/data/notifications/gmailpassword.txt > /dev/null"
