"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type VerifyResult = {
  verified: boolean;
  name?: string;
  petId?: string;
  message?: string;
};

export default function Owner() {
  const [name, setName] = useState("");
  const [chip, setChip] = useState("");
  const [result, setResult] = useState<VerifyResult>();
  const [showName, setShowName] = useState(true);
  const [showCity, setShowCity] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");

  async function verify() {
    const r = await fetch("/api/government/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chip, name }),
    });
    const data = await r.json();
    setResult(data);
    if (data.verified && data.petId) {
      await fetch(`/api/pets/${encodeURIComponent(data.petId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          city: "",
          contact: "",
          showName: true,
          showCity: false,
          showContact: false,
        }),
      });
    }
  }

  const publicUrl = useMemo(() => {
    if (!result?.verified || !result.petId || typeof window === "undefined") return "";
    return `${window.location.origin}/pet/${encodeURIComponent(result.petId)}`;
  }, [result]);

  async function savePublicProfile() {
    if (!result?.verified || !result.petId || !result.name) return;
    await fetch(`/api/pets/${encodeURIComponent(result.petId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: result.name,
        city,
        contact,
        showName,
        showCity,
        showContact,
      }),
    });
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Create a free Digital Pet ID</h1>
        <p>
          Enter the government registration or microchip reference. The MVP
          uses a sandbox connector until an authorized third-party government
          interface is available.
        </p>

        <div className="field">
          <label>Pet name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Milo" />
        </div>

        <div className="field">
          <label>Government / microchip reference</label>
          <input value={chip} onChange={e => setChip(e.target.value)} placeholder="900123456789012" />
        </div>

        <button className="button" onClick={verify}>Verify & create free ID</button>

        {result && (
          <div className={result.verified ? "status" : "status warning"}>
            {result.verified ? `Verified: ${result.name} · ${result.petId}` : result.message}
          </div>
        )}

        {result?.verified && result.petId && (
          <section style={{ marginTop: 24 }}>
            <h2>Choose what the public QR shows</h2>
            <p>
              Only the options you select below are placed in the public QR link.
              Do not add sensitive information.
            </p>

            <div className="field">
              <label>
                <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} />
                {" "}Show pet name
              </label>
              <label>
                <input type="checkbox" checked={showCity} onChange={e => setShowCity(e.target.checked)} />
                {" "}Show city
              </label>
              <label>
                <input type="checkbox" checked={showContact} onChange={e => setShowContact(e.target.checked)} />
                {" "}Show owner contact
              </label>
            </div>

            {showCity && (
              <div className="field">
                <label>City</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Taoyuan" />
              </div>
            )}

            {showContact && (
              <div className="field">
                <label>Public contact message</label>
                <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact me if found" />
              </div>
            )}

            <button className="button" onClick={savePublicProfile} style={{ marginTop: 12 }}>
              Save public profile
            </button>

            {publicUrl && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <div style={{ display: "inline-block", background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #ddd" }}>
                  <QRCodeSVG value={publicUrl} size={220} level="H" />
                </div>
                <p style={{ marginTop: 12, fontWeight: 700 }}>Scan to open this pet's public ID</p>
                <a href={publicUrl} target="_blank" rel="noreferrer">Open public pet page</a>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
