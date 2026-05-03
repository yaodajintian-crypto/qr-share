import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "あなたのapiKey",
  authDomain: "analysis-851bd.firebaseapp.com",
  projectId: "analysis-851bd",
  storageBucket: "analysis-851bd.firebasestorage.app",
  messagingSenderId: "427729308951",
  appId: "あなたのappId",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [roomId, setRoomId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [idea, setIdea] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [savedRooms, setSavedRooms] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("savedRooms") || "[]");
    setSavedRooms(saved);

    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomId(room);
      saveRoom(room);
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, "rooms", roomId, "ideas"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIdeas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [roomId]);

  const saveRoom = (id) => {
    const saved = JSON.parse(localStorage.getItem("savedRooms") || "[]");

    if (saved.includes(id)) return;

    const next = [id, ...saved].slice(0, 10);
    localStorage.setItem("savedRooms", JSON.stringify(next));
    setSavedRooms(next);
  };

  const createRoom = async () => {
    const id = Math.random().toString(36).substring(2, 8);
    setRoomId(id);
    saveRoom(id);

    const url = `${window.location.origin}?room=${id}`;
    const qr = await QRCode.toDataURL(url);
    setQrImage(qr);
  };

  const startScan = async () => {
    const scanner = new Html5Qrcode("reader");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        await scanner.stop();

        const url = new URL(decodedText);
        const room = url.searchParams.get("room");

        if (room) {
          setRoomId(room);
          saveRoom(room);
          setQrImage("");
        } else {
          alert("ルームQRではありません");
        }
      }
    );
  };

  const sendIdea = async () => {
    if (!idea.trim() || !roomId) return;

    await addDoc(collection(db, "rooms", roomId, "ideas"), {
      text: idea,
      likes: 0,
      createdAt: serverTimestamp(),
    });

    setIdea("");
  };

  const likeIdea = async (id) => {
    await updateDoc(doc(db, "rooms", roomId, "ideas", id), {
      likes: increment(1),
    });
  };

  const openSavedRoom = (id) => {
    setRoomId(id);
    setQrImage("");
  };

  const backHome = () => {
    setRoomId("");
    setQrImage("");
    setIdea("");
    setIdeas([]);
  };

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h1>QRアイデア共有</h1>

      {!roomId && (
        <>
          <button onClick={createRoom}>作成</button>

          <button onClick={startScan} style={{ marginLeft: 10 }}>
            読み込み
          </button>

          <div id="reader" style={{ width: 300, marginTop: 20 }}></div>

          <h3>保存済みルーム</h3>

          {savedRooms.length === 0 && <p>まだ保存済みルームはありません。</p>}

          <ul>
            {savedRooms.map((id) => (
              <li key={id}>
                <button onClick={() => openSavedRoom(id)}>
                  ルームID: {id}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {roomId && (
        <>
          <button onClick={backHome}>ホームに戻る</button>

          <h2>ルームID: {roomId}</h2>

          {qrImage && (
            <div>
              <p>このQRを相手に読み込んでもらってください</p>
              <img src={qrImage} alt="QRコード" />
            </div>
          )}

          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="アイデアを書く"
            style={{ width: "100%", padding: 10, marginTop: 20 }}
          />

          <button onClick={sendIdea} style={{ marginTop: 10 }}>
            投稿
          </button>

          <h3>投稿一覧</h3>

          <ul>
            {ideas.map((item) => (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <div>{item.text}</div>
                <button onClick={() => likeIdea(item.id)}>
                  👍 {item.likes || 0}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;