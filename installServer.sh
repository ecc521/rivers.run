read -n 1 -s -r -p "This file is intended to set up a server to host the rivers.run website. It may overwrite stuff without asking. Press any key to continue"

#Get updates
sudo apt-get update
sudo apt-get upgrade

#Install git
sudo apt-get install -y git

#Clone rivers.run
cd $HOME
git clone https://github.com/ecc521/rivers.run.git
git clone https://github.com/ecc521/rivers.run-virtual-gauges.git

#Install NodeJS
curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
sudo apt-get install -y nodejs

#Build rivers.run
cd rivers.run
npm install

#Install apache
sudo apt-get install -y apache2

#Symlink to /var/www/html
sudo mv /var/www/html /var/www/oldhtml #Move /var/www/html instead of deleting it... We don't want to delete anything important.
sudo ln -s $HOME/rivers.run /var/www/html

echo "You will probably need to make sure that .htaccess files are enabled."
echo "Edit the AllowOverride statement in the /var/www/ directory selector in the file /etc/apache2/apache2.conf to say All."

read -n 1 -s -r -p "Press any key to continue"

#Enable needed modules
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod proxy #This is needed for the NodeJS server portion, but not the rest of the site. Enable it now anyways.
sudo a2enmod proxy_http

#Restart apache so configuration changes take effect.
sudo systemctl restart apache2

#Install Certbot
sudo apt-get install -y certbot python-certbot-apache -t stretch-backports
sudo certbot --apache

#Not sure if this works. It should be tested out at some point though.
#echo "Should this program try to automatically enable ProxyPass by editing /etc/apache2/sites-available/000-default.conf? (Y/N)"
#select yn in "Y" "N"; do
#    case $yn in
#        Y )
#			#We can't redirect into a root owned file. Use tee for this.
#			echo "" | sudo tee -a /etc/apache2/sites-available/000-default.conf > /dev/null #Start a new line
#			echo "ProxyRequests on" | sudo tee -a /etc/apache2/sites-available/000-default.conf > /dev/null
#			echo "ProxyPass /node http://127.0.0.1:3000/node" | sudo tee -a /etc/apache2/sites-available/000-default.conf > /dev/null
#			echo "ProxyPassReverse /node http://127.0.0.1:3000/node" | sudo tee -a /etc/apache2/sites-available/000-default.conf > /dev/null
#			sudo systemctl restart apache2
#			echo "Added 3 lines to the end of /etc/apache2/sites-available/000-default.conf to try and enable ProxyPass."
#			echo "Also restarted apache using sudo systemctl restart apache2"
#			echo "If this faiiled, you will need to follow the instructions in $HOME/rivers.run/.htaccess, then restart apache."
#			break
#		;;
#        	N )
#			echo "You will need to enable ProxyPass for the NodeJS server portion to work correctly."
#			echo "Instructions are located in $HOME/rivers.run/.htaccess"
#			echo "After you edit the site config file to add ProxyPass, run sudo systemctl restart apache2"
#			break
#		;;
#    esac
#done
#echo "Hope it's all working!"

echo "You will need to enable ProxyPass for the NodeJS server portion to work correctly."
echo "Add the following 3 lines into /etc/apache2/sites-available/000-default-le-ssl.conf before the end of the VirtualHost statement:"
echo "ProxyRequests on"
echo "ProxyPass /node http://127.0.0.1:3000/node"
echo "ProxyPassReverse /node http://127.0.0.1:3000/node"
echo "After you edit the site config file to add ProxyPass, run sudo systemctl restart apache2"

echo "Run crontab -e (may need sudo). Add the following line:"
echo "@reboot node $HOME/rivers.run/server/usgscache.js --install >> $HOME/rivers.run/server/logs/usgscache.log"

echo "Add stuff about gmailpassword.txt"
