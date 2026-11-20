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
  const [showSpecies, setShowSpecies] = useState(false);
  const [showBreed, setShowBreed] = useState(false);
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy public link");
  const [lost, setLost] = useState(false);
  const [foundReports, setFoundReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsRead, setReportsRead] = useState(false);
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthType, setHealthType] = useState("Vaccination");
  const [healthSummary, setHealthSummary] = useState("");
  const [healthDate, setHealthDate] = useState("");
  const [healthPublic, setHealthPublic] = useState(false);
  const [healthSaving, setHealthSaving] = useState(false);

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
        setShowName(Boolean(existing.showName));
        setShowCity(Boolean(existing.showCity));
        setShowContact(Boolean(existing.showContact));
        setShowSpecies(Boolean(existing.showSpecies));
        setShowBreed(Boolean(existing.showBreed));
        setShowBirthDate(Boolean(existing.showBirthDate));
        setShowPhoto(Boolean(existing.showPhoto));
        setPhotoUrl(existing.photoUrl || "");
        setSpecies(existing.species || "");
        setBreed(existing.breed || "");
        setBirthDate(existing.birthDate || "");
        setCity(existing.city || "");
        setContact(existing.contact || "");
        setLost(Boolean(existing.lost));
        setReportsLoading(true);
        const reportsResponse = await fetch(`/api/pets/${encodeURIComponent(data.petId)}/found?t=${Date.now()}`, { cache: "no-store" });
        if (reportsResponse.ok) {
          const reportsData = await reportsResponse.json();
          setFoundReports(reportsData.reports || []);
          setReportsRead((reportsData.reports || []).every((report: any) => Boolean(report.read_at)));
        }
        setReportsLoading(false);
        setHealthLoading(true);
        const healthResponse = await fetch(`/api/pets/${encodeURIComponent(data.petId)}/health?t=${Date.now()}`, { cache: "no-store" });
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          setHealthRecords(healthData.records || []);
        }
        setHealthLoading(false);
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
        species,
        breed,
        birthDate,
        showSpecies,
        showBreed,
        showBirthDate,
        showPhoto,
        photoUrl,
        lost,
      }),
    });

    setSaving(false);

    if (response.ok) setSaved(true);
  }

  async function uploadPetPhoto() {
    if (!result?.petId || !photoFile) return;

    setPhotoUploading(true);
    setPhotoError("");

    try {
      const formData = new FormData();
      formData.append("photo", photoFile);

      const response = await fetch(
        `/api/pets/${encodeURIComponent(result.petId)}/photo`,
        { method: "POST", body: formData }
      );

      const responseText = await response.text();
      let data: { message?: string; photoUrl?: string } = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { message: responseText };
        }
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Photo upload failed (HTTP ${response.status}).`
        );
      }

      if (!data.photoUrl) {
        throw new Error("Photo upload completed but no photo URL was returned.");
      }

      setPhotoUrl(data.photoUrl);
      setPhotoFile(null);
      setShowPhoto(true);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setPhotoUploading(false);
    }
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

              <section style={{ marginTop: 24 }}>
                <h2>Pet photo</h2>
                <p>Upload a photo directly to secure Cloudflare storage. JPG, PNG, GIF, and WebP images up to 5 MB are supported.</p>

                <div className="field">
                  <label>Choose photo</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={e => {
                      setPhotoFile(e.target.files?.[0] || null);
                      setPhotoError("");
                    }}
                  />
                </div>

                {photoFile && (
                  <div className="status" style={{ marginTop: 8 }}>
                    Selected: {photoFile.name}
                  </div>
                )}

                <button
                  className="button"
                  type="button"
                  onClick={uploadPetPhoto}
                  disabled={!photoFile || photoUploading}
                  style={{ marginTop: 8 }}
                >
                  {photoUploading ? "Uploading..." : "Upload pet photo"}
                </button>

                <div className="field" style={{ marginTop: 12 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={showPhoto}
                      onChange={e => setShowPhoto(e.target.checked)}
                    />{" "}
                    Show pet photo publicly
                  </label>
                </div>

                {photoError && (
                  <div className="status warning" style={{ marginTop: 8 }}>
                    {photoError}
                  </div>
                )}

                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt={result.name ? `${result.name} photo preview` : "Pet photo preview"}
                    style={{ width: "100%", maxWidth: 320, maxHeight: 320, objectFit: "cover", borderRadius: 12, marginTop: 8 }}
                  />
                )}
              </section>

              <section style={{ marginTop: 24 }}>
                <h2>Pet details</h2>
                <p>Optional details that can help identify your pet.</p>
                <div className="field">
                  <label>Species</label>
                  <input value={species} onChange={e => setSpecies(e.target.value)} placeholder="Dog" />
                </div>
                <div className="field">
                  <label>Breed</label>
                  <input value={breed} onChange={e => setBreed(e.target.value)} placeholder="Golden Retriever" />
                </div>
                <div className="field">
                  <label>Birth date</label>
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>
                <div className="field">
                  <label><input type="checkbox" checked={showSpecies} onChange={e => setShowSpecies(e.target.checked)} /> Show species publicly</label>
                  <label><input type="checkbox" checked={showBreed} onChange={e => setShowBreed(e.target.checked)} /> Show breed publicly</label>
                  <label><input type="checkbox" checked={showBirthDate} onChange={e => setShowBirthDate(e.target.checked)} /> Show birth date publicly</label>
                </div>
              </section>

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
              <h2>Lost Pet Mode</h2>
              <div className={lost ? "status warning" : "status"}>
                <strong>{lost ? "🚨 LOST PET" : "Active"}</strong>
                <br />
                {lost
                  ? "The public Pet ID page will prominently show that this pet is lost."
                  : "Mark this pet as lost if you need the public QR page to show a lost-pet alert."}
              </div>
              <label style={{ display: "block", marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={lost}
                  onChange={e => setLost(e.target.checked)}
                />{" "}
                Mark pet as lost
              </label>
              <button
                className="button"
                onClick={savePublicProfile}
                disabled={saving}
                style={{ marginTop: 12 }}
              >
                {saving ? "Saving..." : lost ? "Save lost status" : "Save pet status"}
              </button>
            </section>

            <section style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>Found pet reports</h2>
                  <p style={{ marginTop: 0 }}>People who found your lost pet can send you a message here.</p>
                </div>
                {foundReports.some(report => !report.read_at) && (
                  <span className="status warning" style={{ fontWeight: 800 }}>
                    🔔 {foundReports.filter(report => !report.read_at).length} new
                  </span>
                )}
              </div>

              {reportsLoading ? (
                <p>Loading reports…</p>
              ) : foundReports.length === 0 ? (
                <div className="status">No found-pet reports yet.</div>
              ) : (
                <>
                  {foundReports.map(report => (
                    <div
                      key={report.id}
                      className="status"
                      style={{ marginTop: 12 }}
                    >
                      <strong>{report.finder_name || "Someone who found your pet"}</strong>
                      {!report.read_at && (
                        <span style={{ marginLeft: 8, fontWeight: 800 }}>NEW</span>
                      )}
                      {report.finder_contact && (
                        <div style={{ marginTop: 8 }}>
                          Contact: {report.finder_contact}
                        </div>
                      )}
                      {report.message && (
                        <div style={{ marginTop: 8 }}>
                          Message: {report.message}
                        </div>
                      )}
                      {report.found_location && (
                        <div style={{ marginTop: 8 }}>
                          📍 Found at: {report.found_location}
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        {new Date(report.created_at).toLocaleString()}
                      </div>
                      <button
                        className="button"
                        style={{ marginTop: 10 }}
                        onClick={async () => {
                          if (!result?.petId) return;
                          if (!window.confirm("Remove this found-pet report?")) return;
                          const response = await fetch(
                            `/api/pets/${encodeURIComponent(result.petId)}/found/${encodeURIComponent(report.id)}`,
                            { method: "DELETE" }
                          );
                          if (response.ok) {
                            setFoundReports(reports => reports.filter(item => item.id !== report.id));
                          }
                        }}
                      >
                        Remove report
                      </button>
                    </div>
                  ))}
                  {!reportsRead && (
                    <button
                      className="button"
                      style={{ marginTop: 12 }}
                      onClick={async () => {
                        if (!result?.petId) return;
                        const response = await fetch(`/api/pets/${encodeURIComponent(result.petId)}/found`, {
                          method: "PATCH",
                        });
                        if (response.ok) {
                          setFoundReports(reports => reports.map(report => ({ ...report, read_at: report.read_at || new Date().toISOString() })));
                          setReportsRead(true);
                        }
                      }}
                    >
                      Mark reports as read
                    </button>
                  )}
                </>
              )}
            </section>

            <section style={{ marginTop: 28 }}>
              <h2>Health records</h2>
              <p>Add vaccinations, vet visits, medications, or other useful medical history.</p>

              <div className="field">
                <label>Record type</label>
                <select value={healthType} onChange={e => setHealthType(e.target.value)}>
                  <option>Vaccination</option>
                  <option>Vet visit</option>
                  <option>Medication</option>
                  <option>Procedure</option>
                  <option>Allergy</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="field">
                <label>Date</label>
                <input type="date" value={healthDate} onChange={e => setHealthDate(e.target.value)} />
              </div>

              <div className="field">
                <label>Summary</label>
                <textarea
                  value={healthSummary}
                  onChange={e => setHealthSummary(e.target.value)}
                  placeholder="Rabies vaccination, next due 2027-05-20"
                  rows={3}
                />
              </div>

              <label>
                <input type="checkbox" checked={healthPublic} onChange={e => setHealthPublic(e.target.checked)} />{" "}
                Show this record publicly
              </label>

              <button
                className="button"
                style={{ marginTop: 12 }}
                disabled={healthSaving}
                onClick={async () => {
                  if (!result?.petId) return;
                  if (!healthDate || !healthSummary.trim()) return;
                  setHealthSaving(true);
                  const response = await fetch(`/api/pets/${encodeURIComponent(result.petId)}/health`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      recordType: healthType,
                      summary: healthSummary,
                      occurredAt: healthDate,
                      showPublic: healthPublic,
                    }),
                  });
                  setHealthSaving(false);
                  if (response.ok) {
                    const refreshed = await fetch(`/api/pets/${encodeURIComponent(result.petId)}/health?t=${Date.now()}`, { cache: "no-store" });
                    if (refreshed.ok) {
                      const data = await refreshed.json();
                      setHealthRecords(data.records || []);
                    }
                    setHealthSummary("");
                    setHealthDate("");
                    setHealthPublic(false);
                  }
                }}
              >
                {healthSaving ? "Saving..." : "Add health record"}
              </button>

              {healthLoading ? (
                <p>Loading health records…</p>
              ) : healthRecords.length === 0 ? (
                <div className="status" style={{ marginTop: 12 }}>No health records yet.</div>
              ) : (
                healthRecords.map(record => (
                  <div className="status" key={record.id} style={{ marginTop: 12 }}>
                    <strong>{record.record_type}</strong>
                    <div>{record.occurred_at}</div>
                    <div style={{ marginTop: 6 }}>{record.summary}</div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {record.show_public ? "Public" : "Private"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        className="button"
                        onClick={async () => {
                          if (!result?.petId) return;
                          await fetch(`/api/pets/${encodeURIComponent(result.petId)}/health`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ recordId: record.id, showPublic: !Boolean(record.show_public) }),
                          });
                          const refreshed = await fetch(`/api/pets/${encodeURIComponent(result.petId)}/health?t=${Date.now()}`, { cache: "no-store" });
                          if (refreshed.ok) {
                            const data = await refreshed.json();
                            setHealthRecords(data.records || []);
                          }
                        }}
                      >
                        {record.show_public ? "Make private" : "Show publicly"}
                      </button>
                      <button
                        className="button"
                        onClick={async () => {
                          if (!result?.petId || !window.confirm("Delete this health record?")) return;
                          const response = await fetch(`/api/pets/${encodeURIComponent(result.petId)}/health`, {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ recordId: record.id }),
                          });
                          if (response.ok) setHealthRecords(records => records.filter(item => item.id !== record.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section style={{ marginTop: 28 }}>
              <h2>Pet ID status</h2>
              <p>
                <strong>{lost ? "Lost" : "Active"}</strong> — this Pet ID is available through its public QR page.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
