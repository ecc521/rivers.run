Installing rivers.run enviroment:
```
git clone https://github.com/ecc521/rivers.run.git
cd rivers.run
npm install
```

Once rivers.run is installed, you can build your changes using ```npm run build```.

To generate river data:
```
node server/usgscache.js --runOnce
```

To run fileserver (port 8080 is used):
```
node server.js --serveOnly
```

To run combined:
```
node server.js
```

The Docker image can also be built and run. 
