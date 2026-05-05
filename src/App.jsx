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
  const [likedIdeas, setLikedIdeas] = useState([]);
  const [fontSize, setFontSize] = useState("medium");
  const [summary, setSummary] = useState("");
  const [ideaFontSize, setIdeaFontSize] = useState(16);
  const [ideaType, setIdeaType] = useState("text");

  const fontMap = {
    small: 14,
    medium: 16,
    large: 20,
    xlarge: 24,
  };

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("savedRooms") || "[]");
    setSavedRooms(saved);

    const liked = JSON.parse(localStorage.getItem("likedIdeas") || "[]");
    setLikedIdeas(liked);

    const savedFont = localStorage.getItem("fontSize") || "medium";
    setFontSize(savedFont);

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
    type: ideaType,
    fontSize: ideaFontSize,
    createdAt: serverTimestamp(),
  });

  setIdea("");
};
  const likeIdea = async (id) => {
    const likeKey = `${roomId}-${id}`;

    if (likedIdeas.includes(likeKey)) {
      alert("このアイデアにはすでにいいねしています");
      return;
    }

    await updateDoc(doc(db, "rooms", roomId, "ideas", id), {
      likes: increment(1),
    });

    const next = [...likedIdeas, likeKey];
    localStorage.setItem("likedIdeas", JSON.stringify(next));
    setLikedIdeas(next);
  };

  const generateSummary = () => {
    if (ideas.length === 0) {
      setSummary("まだアイデアがありません。");
      return;
    }

    const texts = ideas.map((item) => item.text);
    const total = texts.length;

    const popular = [...ideas]
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3);

    const shortIdeas = texts.slice(0, 5).join(" / ");

    const result = `
投稿数は全部で${total}件です。

主なアイデア：
${shortIdeas}

いいねが多いアイデア：
${popular
  .map((item, index) => `${index + 1}. ${item.text}（${item.likes || 0}いいね）`)
  .join("\n")}

全体として、参加者から複数の意見が出ており、特にいいねが多い案は優先的に検討する価値があります。
`;

    setSummary(result);
  };

  const changeFontSize = (size) => {
    setFontSize(size);
    localStorage.setItem("fontSize", size);
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
    setSummary("");
  };

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 560,
        margin: "0 auto",
        fontSize: fontMap[fontSize],
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: fontMap[fontSize] + 12 }}>QRアイデア共有</h1>

      <div style={{ marginBottom: 20 }}>
        <strong>文字サイズ：</strong>
        <button onClick={() => changeFontSize("small")}>小</button>
        <button onClick={() => changeFontSize("medium")}>中</button>
        <button onClick={() => changeFontSize("large")}>大</button>
        <button onClick={() => changeFontSize("xlarge")}>特大</button>
      </div>

      {!roomId && (
        <>
          <button onClick={createRoom}>作成</button>

          <button onClick={startScan} style={{ marginLeft: 10 }}>
            読み込み
          </button>

          <div id="reader" style={{ width: 300, marginTop: 20 }}></div>

          <h2>保存済みルーム</h2>

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
            style={{
              width: "100%",
              padding: 12,
              marginTop: 20,
              fontSize: fontMap[fontSize],
            }}
          />

          <button onClick={sendIdea} style={{ marginTop: 10 }}>
            投稿
          </button>

          <h2>投稿一覧</h2>

          <ul>
            {ideas.map((item) => {
              const likeKey = `${roomId}-${item.id}`;
              const alreadyLiked = likedIdeas.includes(likeKey);

              return (
                <li key={item.id} style={{ marginBottom: 16 }}>
                  {item.type === "text" && (
  <div style={{ fontSize: item.fontSize || 16 }}>
    {item.text}
    </div>
  )}
  
  {item.type === "text" && (
  <div style={{ fontSize: item.fontSize || 16 }}>
    {item.text}
  </div>
)}

{item.type === "arrow" && (
  <div style={{ fontSize: item.fontSize || 24 }}>
    ➜ {item.text}
  </div>
)}

{item.type === "bar" && (
  <div>
    <div style={{ fontSize: item.fontSize || 16 }}>
      {item.text}
    </div>
    <div
      style={{
        width: `${Math.min((item.likes || 1) * 30, 300)}px`,
        height: 20,
        background: "#4caf50",
        marginTop: 6,
        borderRadius: 4,
      }}
    />
  </div>
)}
                  <button>
                    onClick={() => likeIdea(item.id)}
                    disabled={alreadyLiked}
                  >
                    👍 {item.likes || 0}
                    {alreadyLiked ? " 済み" : ""}
                  </button>
                </li>
              );
            })}
          </ul>

          <hr />

          <h2>AIまとめ</h2>
          <button onClick={generateSummary}>まとめる</button>

          {summary && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#f2f2f2",
                padding: 12,
                marginTop: 10,
                borderRadius: 8,
                fontSize: fontMap[fontSize],
              }}
            >
              {summary}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

export default App;