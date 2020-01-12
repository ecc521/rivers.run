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
sudo a2enmod http2

#Enable reverse proxy to /node.
echo "LoadModule proxy_module modules/mod_proxy.so" >> $HOME/rivers.run/NODERIVERSRUN.conf
echo "LoadModule proxy_http_module modules/mod_proxy_http.so" >> $HOME/rivers.run/NODERIVERSRUN.conf
#echo "ProxyRequests on" >> $HOME/rivers.run/NODERIVERSRUN.conf #Doesn't appear to be needed. Having this removed should prevent the server from being abused as an open proxy.
echo "ProxyPass /node http://127.0.0.1:3000/node" >> $HOME/rivers.run/NODERIVERSRUN.conf
#echo "ProxyPassReverse /node http://127.0.0.1:3000/node" >> $HOME/rivers.run/NODERIVERSRUN.conf #Doesn't appear to be needed.

echo "LoadModule http2_module modules/mod_http2.so" >> $HOME/rivers.run/NODERIVERSRUN.conf
echo "Protocols h2 http/1.1" >> $HOME/rivers.run/NODERIVERSRUN.conf


sudo mv $HOME/rivers.run/NODERIVERSRUN.conf /etc/apache2/conf-available/NODERIVERSRUN.conf
sudo a2enconf NODERIVERSRUN #To disable, run sudo a2disconf NODERIVERSRUN

#Restart apache so configuration changes take effect.
sudo systemctl restart apache2

#Install Certbot
sudo apt-get install -y certbot python-certbot-apache -t stretch-backports
sudo certbot --apache

echo "Add stuff about gmailpassword.txt"
echo "Swap file reccomended, at least to bring up available memory to 512MB for this process (1GB preferred). More than 200MB will probably not be used at any one time."
echo "Google Cloud Compute Engine: https://badlywired.com/2016/08/15/adding-swap-google-compute-engine/"

echo "Run crontab -e (may need sudo). Add the following lines:"
echo "@reboot node $HOME/rivers.run/server/usgscache.js >> $HOME/rivers.run/server/logs/usgscache.log"
echo "*/15 * * * * node $HOME/rivers.run/server/restartServer.js >> $HOME/rivers.run/server/logs/restartServer.log"
echo "0 4   *   *   *    sudo reboot"
echo "@reboot sudo certbot renew  >> $HOME/rivers.run/server/logs/updateCertificate.log"

echo "\nExplanation: Run server on reboot. Run restartServer.js every 15 minutes. Reboot at 4am every day. Run certbot renew on each reboot."
echo "We reboot the server at 4am every day in an attempt to resolve an issue where, after running for a few days, the server (probably kernel) would lock up, reading at full speed from the disk and doing nothing else."
