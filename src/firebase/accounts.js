import firebase from 'firebase/compat/app';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import "firebase/compat/firestore";

// import { deleteField } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8hvftc7idpGNcj5I9gvOqk-DQrTrkQco",
  authDomain: "rivers-run.firebaseapp.com",
  projectId: "rivers-run",
  storageBucket: "rivers-run.appspot.com",
  messagingSenderId: "781093992108",
  appId: "1:781093992108:web:a5a9db5b62f1d554c61109",
  measurementId: "G-ZP92G9QBYB"
};

firebase.initializeApp(firebaseConfig)




//Accounts
let auth = firebase.auth()
auth.setPersistence("local")

function getCurrentUser() {
    return auth?.currentUser
}

function getUserEmail() {
    return getCurrentUser()?.email
}

function getUID() {
    return getCurrentUser()?.uid
}

function signOut() {
    return auth.signOut()
}

function deleteAccount() {
    return getCurrentUser().delete()
}



//Database
const usersCollectionName = "users"
let db = firebase.firestore();
let users = db.collection("users")

function getUserDoc() {
    return users.doc(getUID())
}

async function getData() {
	let data = (await getUserDoc().get()).data()
	return data
}

async function setData(data, merge = true) {
    console.log(data)
    return await getUserDoc().set(data, {merge})
}

async function getFavoritesLastModified(data) {
    data = data || await getData()
	return data?.favoritesLastModified
}

async function getFavorites(data) {
    data = data || await getData()
	return data?.favorites || {}
}

async function getNotificationsConfig(data) {
    data = data || await getData()
    return data?.notifications || {}
}

async function setFavorites(favorites, merge) {
    return await setData({
        favorites,
        favoritesLastModified: Date.now(),
    }, merge)
}

async function setNotificationsConfig(notifications, merge) {
    return await setData({notifications}, merge)
}

export {
    firebase, //FirebaseUI requires this.

    //Accounts
    getCurrentUser,
    getUserEmail,
    getUID,
    signOut,

    //Database
	getData,
    setData,
	getFavorites,
    setFavorites,
    getFavoritesLastModified,
    getNotificationsConfig,
    setNotificationsConfig,
}
