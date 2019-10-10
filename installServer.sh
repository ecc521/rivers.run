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
echo "ProxyRequests on" >> $HOME/rivers.run/NODERIVERSRUN.conf
echo "ProxyPass /node http://127.0.0.1:3000/node" >> $HOME/rivers.run/NODERIVERSRUN.conf
echo "ProxyPassReverse /node http://127.0.0.1:3000/node" >> $HOME/rivers.run/NODERIVERSRUN.conf

echo "LoadModule http2_module modules/mod_http2.so" >> $HOME/rivers.run/NODERIVERSRUN.conf
echo "Protocols h2 http/1.1" >> $HOME/rivers.run/NODERIVERSRUN.conf


sudo mv $HOME/rivers.run/NODERIVERSRUN.conf /etc/apache2/conf-available/NODERIVERSRUN.conf
sudo a2enconf NODERIVERSRUN #To disable, run sudo a2disconf NODERIVERSRUN

#Restart apache so configuration changes take effect.
sudo systemctl restart apache2

#Install Certbot
sudo apt-get install -y certbot python-certbot-apache -t stretch-backports
sudo certbot --apache

echo "Run crontab -e (may need sudo). Add the following line:"
echo "@reboot node $HOME/rivers.run/server/usgscache.js >> $HOME/rivers.run/server/logs/usgscache.log"

echo "Add stuff about gmailpassword.txt"
