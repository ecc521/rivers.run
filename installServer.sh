read -p "This file is intended to set up a server to host the rivers.run website. It may overwrite stuff without asking, although will attempt to avoid destroying existing config. Press enter to continue"

#Get updates
sudo apt-get update
sudo apt-get upgrade -y

#Install git
sudo apt-get install -y git

#Clone rivers.run
cd $HOME
git clone https://github.com/ecc521/rivers.run.git
git clone https://github.com/ecc521/rivers.run-virtual-gauges.git

#Install NodeJS
curl -sL https://deb.nodesource.com/setup_15.x | sudo bash -
sudo apt-get install -y nodejs

#Build rivers.run
cd rivers.run
npm install

#Install apache
sudo apt-get install -y apache2

#Enable needed modules
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod proxy #This is needed for the NodeJS server portion, but not the rest of the site. Enable it now anyways.
sudo a2enmod proxy_http
sudo a2enmod http2


sudo rm /etc/apache2/sites-available/rivers.run.conf

sudo tee -a /etc/apache2/sites-available/rivers.run.conf > /dev/null << EOF
<VirtualHost *:80>
		ServerAdmin admin@rivers.run
		ServerName rivers.run
		ServerAlias www.rivers.run
		DocumentRoot $HOME/rivers.run
		ErrorLog ${APACHE_LOG_DIR}/rivers.runerror.log
		CustomLog ${APACHE_LOG_DIR}/rivers.runaccess.log combined
</VirtualHost>

LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
ProxyPass /node http://127.0.0.1:5329/node

LoadModule http2_module modules/mod_http2.so
Protocols h2 http/1.1

AddOutputFilterByType DEFLATE application/json
EOF

sudo a2ensite rivers.run

sudo tee -a /etc/apache2/conf-available/rivers.run.conf > /dev/null << EOF
<Directory $HOME/rivers.run/>
    	Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
</Directory>
EOF

sudo a2enconf rivers.run #To disable, run sudo a2disconf NODEQIALDB

#Restart apache so configuration changes take effect.
sudo systemctl restart apache2

#Install Certbot
sudo apt-get install -y certbot python-certbot-apache -t stretch-backports
sudo certbot --apache

echo "Add stuff about gmailpassword.txt"
echo "Swap file recommended, at least to bring up available memory to 512MB for this process (1GB preferred). More than 200MB will probably not be used at any one time."
echo "Google Cloud Compute Engine: https://badlywired.com/2016/08/15/adding-swap-google-compute-engine/"

echo "Setting crontab to run server on reboot, run restartServer.js every 30 minutes, reboot at 4am every day, and rcun certbot renew on each reboot."
echo "We reboot the server at 4am every day in an attempt to resolve an issue where, after running for a few days, the server (probably kernel) would lock up, reading at full speed from the disk and doing nothing else."

(crontab -l ; echo "@reboot node $HOME/rivers.run/server/usgscache.js >> $HOME/rivers.run/server/logs/usgscache.log") | sort - | uniq - | crontab -
(crontab -l ; echo "*/30 * * * * node $HOME/rivers.run/server/restartServer.js >> $HOME/rivers.run/server/logs/restartServer.log") | sort - | uniq - | crontab -
(crontab -l ; echo "0 0 * * MON sudo reboot") | sort - | uniq - | crontab -
(crontab -l ; echo "@reboot sudo certbot renew") | sort - | uniq - | crontab -

echo "Rebooting now is recommended, and should start the site up properly. "
