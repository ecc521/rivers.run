echo "Remember to run npx cap update if you installed any new native plugins"

node tileDownload.js
mv capacitorDir/tileImages ../tempTileImages #We don't want to delete these - then we would need to redownload.

rm -rf capacitorDir
mkdir capacitorDir
# node copyHtmlCapacitor.js

mv ../tempTileImages capacitorDir/tileImages #Restore the tile directory to it's correct location. 

cp index.html capacitorDir/index.html

#TODO: We could copy slightly less than we currently do, or only copy changes, not copy everything.
mv node_modules ../rrunnodemodulestemp #node_modules has HTML files...
find . -type f -name "*.html" -exec install -v {} capacitorDir/{} \;
rsync -av --progress resources capacitorDir --exclude ios #Don't copy the ios resources.
rsync -av --progress packages capacitorDir
cp -r legal capacitorDir/legal
cp riverdata.json capacitorDir/riverdata.json
cp flowdata3.json capacitorDir/flowdata3.json

mv ../rrunnodemodulestemp node_modules

npx cap copy
npx cap open ios #Open in XCode
