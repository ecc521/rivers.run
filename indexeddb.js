//indexeddb.js JavaScript Function Library
//https://github.com/ecc521/librarys/blob/master/indexeddb.js

//Copyright (©) 2019 Tucker Willenborg, MIT License


(function() {

//We need to defind loader so that appendto.new can be set.
let loader = function(appendto){

    if (!appendto || typeof appendto !== "object") {
        throw new Error("You must pass an object as parameter number 1. The methods will be added to that object.")
    }



    function database(_db) {
        this.name = _db.name

        this.set = function(key, value) {
            let trans = _db.transaction("data", "readwrite")
            let store = trans.objectStore("data");

            //It's an objectStore, so lets make an object
            let obj = {key:key,value:value}

            let request = store.put(obj);

            return new Promise(function(resolve, reject){
                request.onsuccess = resolve
                request.onerror = reject
            })
        }

        this.get = function(key) {
            let trans = _db.transaction("data", "readonly")
            let store = trans.objectStore("data");

            let request = store.get(key)

            return new Promise(function(resolve, reject){

                request.onsuccess = function(){
                    //Check that the value exists
                    if(request.result) {
                        resolve(request.result.value)
                    }
                    else {resolve(null)} //Return null if doesn't exist
                }

                request.onerror = reject
            })
        }

        this.delete = function(key) {
            let trans = _db.transaction("data", "readwrite")
            let store = trans.objectStore("data");

            let request = store.delete(key)


            return new Promise(function(resolve, reject){
                request.onsuccess = resolve
                request.onerror = reject
            })
        }
    }






    appendto.loaddb = function(dbname){
        return new Promise(function(resolve,reject){

            let store = indexedDB.open(dbname, 1);

            store.onupgradeneeded = function(event){
                let db = event.target.result;
                db.createObjectStore("data", { keyPath: "key" });
            }

            store.onsuccess = function(){
                resolve(new database(store.result))
            }

        })
    }

    appendto.deletedb = async function(dbname){
        let request = indexedDB.deleteDatabase(dbname);

        return new Promise(function(resolve,reject){
            request.onsuccess = resolve
            request.onerror = reject
        })
    }



    //Library cloning function
    if (!appendto._duplist) {
        appendto._duplist = []
    }
    //Add the loading function
    appendto._duplist.push(loader)

    //If the user wants to duplicate the library, they call this.
    //It creates a new object, then calls the method creators on them
    appendto.duplicate = function() {
        var obj = {}
        for (let i = 0;i<appendto._duplist.length;i++) {
            appendto._duplist[i](obj)
        }
        return obj;
    }


};

if (!self.lib) {self.lib = {}}
else if (typeof self.lib !== "object") {
    self.lib = {}
    console.warn("Overwrite non-object value of self.lib")
}
loader(lib)
}())
