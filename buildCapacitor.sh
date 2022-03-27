echo "Remember to run npx cap update if you installed any new native plugins"

rm -rf capacitorDir
cp -r native capacitorDir

mkdir capacitorDir/www

npm run build #Create build version.

mkdir capacitorDir/www/packages/
cp packages/*.js capacitorDir/www/packages/
cp packages/*.css capacitorDir/www/packages/

cp -r *.html capacitorDir/www/

cp -r legal capacitorDir/www/legal
mkdir capacitorDir/www/resources

cp resources/* capacitorDir/www/resources #Intentionally NOT recurisve.

cp riverdata.json capacitorDir/www/riverdata.json #Make basic data available after install.

cp ed.jpg capacitorDir/www/ed.jpg

npx cap copy
npx cap open ios #Open in XCode
