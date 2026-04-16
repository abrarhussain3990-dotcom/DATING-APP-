import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔥 YOUR CONFIG (as provided)
const firebaseConfig = {
  apiKey: "AIzaSyCnRVGZNdmrAAuvxTTHGtDYDcFQnbXrJVA",
  authDomain: "love-dating-b4b20.firebaseapp.com",
  databaseURL: "https://love-dating-b4b20-default-rtdb.firebaseio.com",
  projectId: "love-dating-b4b20",
  storageBucket: "love-dating-b4b20.firebasestorage.app",
  messagingSenderId: "720253439790",
  appId: "1:720253439790:web:79e4eba26e16df0bfbb4bf",
  measurementId: "G-857MCQ0TLC"
};

// init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let chatWith = null;

// ➕ Add user
window.addUser = async function () {
  const name = document.getElementById("name").value;
  if (!name) return alert("Enter name");

  const ref = await addDoc(collection(db, "users"), {
    name,
    likes: []
  });

  currentUser = { id: ref.id, name };

  alert("User added!");
};

// 👥 Load users
onSnapshot(collection(db, "users"), (snap) => {
  let html = "";

  snap.forEach((d) => {
    const u = d.data();

    html += `
      <div>
        <b>${u.name}</b><br>
        <button onclick="likeUser('${d.id}', '${u.name}')">❤️ Like</button>
      </div>
    `;
  });

  document.getElementById("users").innerHTML = html;
});

// ❤️ Like + Match
window.likeUser = async function (id, name) {
  if (!currentUser) return alert("Add yourself first!");

  const ref = doc(db, "users", id);
  const snap = await getDoc(ref);

  let likes = snap.data().likes || [];

  if (likes.includes(currentUser.id)) {
    alert("💖 MATCH with " + name);
    chatWith = id;
  } else {
    likes.push(currentUser.id);
    await updateDoc(ref, { likes });
    alert("Liked!");
  }
};

// 💬 Send message
window.sendMsg = async function () {
  const msg = document.getElementById("msg").value;
  if (!msg || !chatWith) return;

  await addDoc(collection(db, "chats"), {
    from: currentUser.id,
    to: chatWith,
    text: msg,
    time: Date.now()
  });

  document.getElementById("msg").value = "";
};

// 💬 Load chat
onSnapshot(query(collection(db, "chats"), orderBy("time")), (snap) => {
  let html = "";

  snap.forEach((d) => {
    const c = d.data();

    if (!currentUser) return;

    if (
      (c.from === currentUser.id && c.to === chatWith) ||
      (c.from === chatWith && c.to === currentUser.id)
    ) {
      html += `<p>${c.text}</p>`;
    }
  });

  document.getElementById("chatBox").innerHTML = html;
});
