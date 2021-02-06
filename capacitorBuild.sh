npx cap add ios && npx cordova-res ios --copy #Generate the ios directory and icons (errors if doesn't exist)

rm -rf capacitorDir
mkdir capacitorDir
# node copyHtmlCapacitor.js
# cp -r resources capacitorDir/resources
# cp -r packages capacitorDir/packages

cp index.html capacitorDir/index.html #Irrelevant

npx cap copy
npx cap open ios #Open in XCode
