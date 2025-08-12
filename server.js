import "dotenv/config";
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_, res) => res.send("OK"));

const PRICES_TEXT = process.env.PRICES_TEXT || `Promosi Android+Satelit Box (sekali bayar – tiada bil bulanan).
• Pakej A: <ISI HARGA> – Box sahaja
• Pakej B: <ISI HARGA> – Box + aksesori asas
• Pakej C: <ISI HARGA> – Set lengkap + sokongan pemasangan
COD/Pos ada. Nak saya cadangkan pakej ikut TV & internet rumah?`;

const WARRANTY_TEXT = process.env.WARRANTY_TEXT || `Waranti kedai: <ISI TEMPOH> bulan untuk hardware (box, adaptor). Tukar/repair ikut polisi. Simpan resit/rujukan order.`;

const COD_AREAS = process.env.COD_AREAS || `<ISI LOKASI COD>`;
const COURIER_INFO = process.env.COURIER_INFO || `<ISI KURIER> (ETA <ISI HARI> hari bekerja)`;

const systemPrompt = `
Anda pembantu jualan mesra untuk "Android + Satelit Box".
Jangan sebut jenama pihak lain atau saluran berhak cipta. Guna frasa umum.
Gaya: BM santai, padat, jelas (boleh selit Kelate ringan bila sesuai).
Objektif:
- Terangkan fungsi: plug & play, guna WiFi ATAU piring Astro/NJOI sedia ada, tiada bil bulanan, banyak pilihan saluran, boleh pasang app (YouTube dsb.), 4K ikut sumber & TV, support lepas jualan.
- Beri langkah pasang ringkas, tawar bantuan sampai jadi (group support/tutorial).
- CTA konsisten: HARGA, ORDER, PASANG, SIARAN, WARRANTY, SUPPORT, COD, POS, STOK, VIDEO, MANUAL.
- Jika soalan kabur, tanya 1 soalan ringkas saja untuk jelas.
- Akhiri dgn ajakan ringkas (“Nak senarai HARGA atau terus ORDER?”).
Logistik:
- COD: ${COD_AREAS}. Pos: ${COURIER_INFO}. Sabah/Sarawak/Labuan +RM20 (jika pos).
Kepatuhan: elak janji melampau & sebutan berhak cipta.
`;

function extractTextAndSender(body = {}) {
  const q = body.query || body;
  const userText = (q.message || body.message || q.text || body.text || q.body || "").toString();
  const sender = (q.sender || body.sender || q.from || body.from || q.number || "Pelanggan").toString();
  return { userText, sender };
}

function cannedReply(key){
  switch (key) {
    case "HARGA": return PRICES_TEXT;
    case "ORDER": return `Baik! Hantar ikut format:
Nama penuh:
Alamat penuh:
No Telefon:
Kaedah: COD / Pos
Kami semak stok & sahkan. (Pos Sabah/Sarawak/Labuan +RM20).`;
    case "PASANG": return `Langkah cepat:
1) Sambung HDMI ke TV & kuasa.
2) Pilih: WiFi ATAU piring Astro/NJOI sedia ada.
3) Ikut tetapan di skrin (manual/video disediakan).
Jika tersekat, hantar gambar skrin – kami guide sampai jadi.`;
    case "SIARAN": return `Ada pelbagai kandungan: saluran tempatan & antarabangsa (berita, sukan, hiburan, kartun, dokumentari, dll) + app internet (YouTube, dsb.). Kualiti ikut sumber & sambungan. Nak saya cadang setup ikut kegunaan?`;
    case "WARRANTY": return WARRANTY_TEXT;
    case "SUPPORT": return `Support lepas jualan (chat/group) + manual & video. Ada isu, hantar gambar skrin – kami bantu step-by-step.`;
    case "COD": return `COD di kawasan: ${COD_AREAS}. Luar kawasan guna Pos (Sabah/Sarawak/Labuan +RM20). Nak tetapkan slot COD atau terus Pos?`;
    case "POS": return `Pos seluruh Malaysia: ${COURIER_INFO}. Sabah/Sarawak/Labuan +RM20. Nak saya kira kos & hantar butiran pembayaran?`;
    case "STOK": return `Stok: <ISI STATUS>. Nak lock harga promo? Balas ORDER.`;
    case "VIDEO": return `Video panduan ringkas tersedia. Nak link YouTube atau PDF manual?`;
    case "MANUAL": return `Manual pemasangan (PDF + gambar) ada. Nak saya hantar sekarang?`;
    default: return null;
  }
}

app.post("/reply", async (req, res) => {
  try {
    const { userText, sender } = extractTextAndSender(req.body || {});
    if (!userText) return res.send("Maaf, mesej kosong diterima. Boleh ulang mesej?");

    const t = userText.trim().toUpperCase();
    const canned = cannedReply(t);
    if (canned) return res.send(canned);

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Nama: ${sender}\nMesej: ${userText}` }
        ]
      })
    });

    const data = await openaiRes.json();
    const reply =
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output_text ||
      "Maaf, boleh ulang mesej? Saya tak berapa jelas.";

    return res.send(reply);
  } catch (e) {
    console.error("ERR /reply:", e);
    return res.send("Maaf, sistem sibuk sekejap. Balas HARGA / ORDER / PASANG / SIARAN untuk info segera.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Webhook listening on " + port));
