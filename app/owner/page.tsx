"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";

type VerifyResult = {
  verified: boolean;
  name?: string;
  petId?: string;
  message?: string;
};

export default function Owner() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [chip, setChip] = useState("");
  const [result, setResult] = useState<VerifyResult>();
  const [showName, setShowName] = useState(true);
  const [showCity, setShowCity] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy public link");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.authenticated) {
          router.replace("/login");
          return;
        }
        setEmail(data.user.email);
        setCheckingAuth(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function verify() {
    setSaved(false);
    const r = await fetch("/api/government/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chip, name }),
    });
    const data = await r.json();
    setResult(data);

    if (data.verified && data.petId) {
      const profile = await fetch(`/api/pets/${encodeURIComponent(data.petId)}`);
      if (profile.ok) {
        const existing = await profile.json();
        setShowName(Boolean(existing.name));
        setShowCity(Boolean(existing.city));
        setShowContact(Boolean(existing.contact));
        setCity(existing.city || "");
        setContact(existing.contact || "");
      }
    }
  }

  const publicUrl = useMemo(() => {
    if (!result?.verified || !result.petId || typeof window === "undefined") return "";
    return `${window.location.origin}/pet/${encodeURIComponent(result.petId)}`;
  }, [result]);

  async function savePublicProfile() {
    if (!result?.verified || !result.petId || !result.name) return;

    setSaving(true);
    setSaved(false);

    const response = await fetch(`/api/pets/${encodeURIComponent(result.petId)}`, {
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

    setSaving(false);

    if (response.ok) setSaved(true);
  }

  async function copyPublicLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopyLabel("Copied!");
    window.setTimeout(() => setCopyLabel("Copy public link"), 1800);
  }

  if (checkingAuth) {
    return (
      <main className="page">
        <div className="card">
          <p>Checking owner account…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <p>🐾 Taiwan Pet ID</p>
            <h1>Owner Dashboard</h1>
          </div>
          <button className="button" onClick={logout}>Sign out</button>
        </div>

        <p>Signed in as {email}</p>
        <p>Verify a pet to manage its public profile, QR code, and Pet ID page.</p>

        {!result?.verified && (
          <section>
            <h2>My Pet</h2>

            <div className="field">
              <label>Pet name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Milo" />
            </div>

            <div className="field">
              <label>Government / microchip reference</label>
              <input
                value={chip}
                onChange={e => setChip(e.target.value)}
                placeholder="900123456789012"
              />
            </div>

            <button className="button" onClick={verify}>
              Verify & open dashboard
            </button>

            {result && (
              <div className={result.verified ? "status" : "status warning"}>
                {result.verified
                  ? `Verified: ${result.name} · ${result.petId}`
                  : result.message}
              </div>
            )}
          </section>
        )}

        {result?.verified && result.petId && (
          <>
            <section className="status" style={{ marginTop: 20 }}>
              <strong>{result.name}'s Pet ID</strong>
              <br />
              {result.petId}
            </section>

            <section style={{ marginTop: 24 }}>
              <h2>Public profile</h2>
              <p>Choose exactly what someone who scans the QR code can see.</p>

              <div className="field">
                <label>
                  <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} />{" "}
                  Show pet name
                </label>
                <label>
                  <input type="checkbox" checked={showCity} onChange={e => setShowCity(e.target.checked)} />{" "}
                  Show city
                </label>
                <label>
                  <input type="checkbox" checked={showContact} onChange={e => setShowContact(e.target.checked)} />{" "}
                  Show owner contact
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
                  <input
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    placeholder="Contact me if found"
                  />
                </div>
              )}

              <button className="button" onClick={savePublicProfile} disabled={saving} style={{ marginTop: 12 }}>
                {saving ? "Saving..." : "Save public profile"}
              </button>

              {saved && (
                <div className="status" style={{ marginTop: 12 }}>
                  Public profile saved successfully.
                </div>
              )}
            </section>

            {publicUrl && (
              <section style={{ marginTop: 28, textAlign: "center" }}>
                <h2>Pet QR code</h2>
                <div style={{ display: "inline-block", background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #ddd" }}>
                  <QRCodeSVG value={publicUrl} size={220} level="H" />
                </div>

                <p style={{ marginTop: 12, fontWeight: 700 }}>
                  Scan to open {result.name}'s public Pet ID
                </p>

                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href={publicUrl} target="_blank" rel="noreferrer">Open public pet page</a>
                  <button className="button" onClick={copyPublicLink}>{copyLabel}</button>
                </div>
              </section>
            )}

            <section style={{ marginTop: 28 }}>
              <h2>Pet ID status</h2>
              <p><strong>Active</strong> — this Pet ID is available through its public QR page.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
