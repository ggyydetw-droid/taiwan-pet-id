"use client";

import { useState } from "react";

type VerifyResult = {
  verified: boolean;
  name?: string;
  petId?: string;
  message?: string;
};

export default function Clinic() {
  const [chip, setChip] = useState("");
  const [result, setResult] = useState<VerifyResult>();
  const [recordType, setRecordType] = useState("Vet visit");
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function lookup() {
    setResult(undefined);
    setSaved("");
    setError("");

    const response = await fetch("/api/clinic/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chip }),
    });

    const data = await response.json().catch(() => ({}));
    setResult(data);

    if (!response.ok) {
      setError(data.message || "Unable to verify the pet.");
    }
  }

  async function addVisit() {
    if (!result?.verified || !result.petId) return;

    setSaving(true);
    setSaved("");
    setError("");

    const response = await fetch("/api/clinic/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        petId: result.petId,
        recordType,
        occurredAt: date,
        summary,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(data.message || "Unable to save the visit record.");
      return;
    }

    setSaved("Visit record added successfully.");
    setSummary("");
    setDate("");
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Veterinary Clinic Portal</h1>
        <p>
          Verify a pet and add veterinary visit records without replacing
          existing clinic software.
        </p>

        <div className="field">
          <label>Microchip / government reference</label>
          <input
            value={chip}
            onChange={e => setChip(e.target.value)}
            placeholder="900123456789012"
          />
        </div>

        <button className="button" onClick={lookup} disabled={!chip.trim()}>
          Verify pet
        </button>

        {result && (
          <div className={result.verified ? "status" : "status warning"} style={{ marginTop: 12 }}>
            {result.verified
              ? `Government verified: ${result.name} · ${result.petId}`
              : result.message}
          </div>
        )}

        {result?.verified && result.petId && (
          <section style={{ marginTop: 24 }}>
            <h2>Add visit record</h2>

            <div className="field">
              <label>Record type</label>
              <select value={recordType} onChange={e => setRecordType(e.target.value)}>
                <option>Vet visit</option>
                <option>Vaccination</option>
                <option>Medication</option>
                <option>Procedure</option>
                <option>Allergy</option>
                <option>Other</option>
              </select>
            </div>

            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Visit summary</label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Annual examination. Rabies vaccination administered."
                rows={4}
              />
            </div>

            <button
              className="button"
              onClick={addVisit}
              disabled={saving || !date || !summary.trim()}
            >
              {saving ? "Saving..." : "Add visit record"}
            </button>

            {saved && (
              <div className="status" style={{ marginTop: 12 }}>
                {saved}
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="status warning" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
