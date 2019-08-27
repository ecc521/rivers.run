//Used to determine where search parameters match the default.
//This is rather ineffecient, because it has to be called twice. A new system (probably using object.keys()) should be used instead.
	function _objectsEqual(obj1, obj2) {
		//Tells if all properties, recursively, match.

		//Avoid property of undefined issues.
		if (obj1 === undefined || obj2 === undefined) {
			if (obj1 !== obj2) {return false}
			return true
		}

		for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (!objectsEqual(obj1[property], obj2[property])) {
					return false
				}
			}
			else {
				if (obj1[property] !== obj2[property]) {
					return false
				}
			}
		}
		return true
	}

	function objectsEqual(obj1, obj2) {
		return _objectsEqual(obj1, obj2) && _objectsEqual(obj2, obj1)
	}

function deleteMatchingPortions(obj1, obj2) {
	//Deletes all properties on obj1, recursively, that are identical to obj2
	if (!obj1 || !obj2) {
		return obj1
	}
	for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (objectsEqual(obj1[property], obj2[property])) {
					//If the objects are equal, delete them.
					delete obj1[property]
				}
				//With an array, positional data can be totally lost by this. Do not delete portions of arrays.
				else if (!(obj1[property] instanceof Array)) {
					//Delete the portions of the objects that match.
					deleteMatchingPortions(obj1[property], obj2[property])
				}
			}
			else {
				if (obj1[property] === obj2[property]) {
					delete obj1[property]
				}
			}
		}
	return obj1
}

function recursiveAssign(target, ...objects) {
	if (objects.length > 1) {
		for (let i=0;i<objects.length;i++) {
			recursiveAssign(target, objects[i])
		}
	}
	else {
		let object = objects[0]
		for (let property in object) {
			if (typeof object[property] === "object") {
				if (typeof target[property] !== "object") {
					//Fixing needed!!!
					//Right here we need to clone, recursively, object[property]
					//Object.assign() is only one level deep.
					target[property] = recursiveAssign({}, object[property])
				}
				else {
					//Setting target[property] to the result probably isn't needed.
					target[property] = recursiveAssign(target[property], object[property])
				}
			}
			else {
				target[property] = object[property]
			}
		}
	}
	return target
}

module.exports = {
	recursiveAssign,
	deleteMatchingPortions,
	objectsEqual
}
