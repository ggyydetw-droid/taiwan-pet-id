"use client";

import { useState } from "react";

type VerifyResult = {
  verified: boolean;
  name?: string;
  petId?: string;
  message?: string;
};

type Visit = {
  id: string;
  record_type: string;
  summary: string;
  occurred_at: string;
  show_public?: number;
};

export default function Clinic() {
  const [chip, setChip] = useState("");
  const [result, setResult] = useState<VerifyResult>();
  const [loading, setLoading] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitSummary, setVisitSummary] = useState("");
  const [visitPublic, setVisitPublic] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitMessage, setVisitMessage] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);

  async function lookup() {
    setLoading(true);
    setResult(undefined);
    setVisitMessage("");
    setVisits([]);

    try {
      const r = await fetch("/api/government/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chip }),
      });
      const data = await r.json();
      setResult(data);

      if (data.verified && data.petId) {
        const records = await fetch(
          `/api/pets/${encodeURIComponent(data.petId)}/health?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (records.ok) {
          const recordsData = await records.json();
          setVisits(
            (recordsData.records || []).filter(
              (record: Visit) =>
                record.record_type === "Vet visit" ||
                record.record_type === "Clinic visit"
            )
          );
        }
      }
    } catch {
      setResult({
        verified: false,
        message: "Unable to verify the pet right now.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function addVisit() {
    if (!result?.petId || !visitDate || !visitSummary.trim()) {
      setVisitMessage("Visit date and summary are required.");
      return;
    }

    setVisitSaving(true);
    setVisitMessage("");

    try {
      const response = await fetch(
        `/api/clinic/visits`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            petId: result.petId,
            occurredAt: visitDate,
            summary: visitSummary.trim(),
            showPublic: visitPublic,
          }),
        }
      );

      const text = await response.text();
      let data: { message?: string; saved?: boolean } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to save visit (HTTP ${response.status}).`
        );
      }

      setVisitMessage("Visit record added successfully.");
      setVisitDate("");
      setVisitSummary("");
      setVisitPublic(false);
      setVisitOpen(false);

      const refreshed = await fetch(
        `/api/pets/${encodeURIComponent(result.petId)}/health?t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setVisits(
          (refreshedData.records || []).filter(
            (record: Visit) =>
              record.record_type === "Vet visit" ||
              record.record_type === "Clinic visit"
          )
        );
      }
    } catch (error) {
      setVisitMessage(
        error instanceof Error ? error.message : "Unable to save visit."
      );
    } finally {
      setVisitSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Veterinary Clinic Portal</h1>
        <p>
          Verify a pet and access owner-authorized health records without
          replacing existing clinic software.
        </p>

        <div className="field">
          <label>Microchip / government reference</label>
          <input
            value={chip}
            onChange={e => setChip(e.target.value)}
            placeholder="900123456789012"
          />
        </div>

        <button className="button" onClick={lookup} disabled={loading}>
          {loading ? "Verifying..." : "Verify pet"}
        </button>

        {result && (
          <div className={result.verified ? "status" : "status warning"}>
            {result.verified
              ? `Government verified: ${result.name} · ${result.petId}`
              : result.message}
          </div>
        )}

        {result?.verified && result.petId && (
          <section style={{ marginTop: 24 }}>
            <h2>Health record</h2>

            {visits.length === 0 ? (
              <p>Visits: No records yet.</p>
            ) : (
              <>
                <p>Visits: {visits.length}</p>
                {visits.map(visit => (
                  <div className="status" key={visit.id} style={{ marginTop: 12 }}>
                    <strong>Vet visit</strong>
                    <div>{visit.occurred_at}</div>
                    <div style={{ marginTop: 6 }}>{visit.summary}</div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {visit.show_public ? "Shared publicly" : "Private"}
                    </div>
                  </div>
                ))}
              </>
            )}

            <button
              className="button"
              style={{ marginTop: 16 }}
              onClick={() => {
                setVisitOpen(open => !open);
                setVisitMessage("");
              }}
            >
              {visitOpen ? "Cancel" : "Add visit record"}
            </button>

            {visitOpen && (
              <div style={{ marginTop: 16 }}>
                <div className="field">
                  <label>Visit date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Visit summary</label>
                  <textarea
                    value={visitSummary}
                    onChange={e => setVisitSummary(e.target.value)}
                    placeholder="Annual examination, healthy. Rabies vaccination administered."
                    rows={4}
                  />
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={visitPublic}
                    onChange={e => setVisitPublic(e.target.checked)}
                  />{" "}
                  Share this visit on the public Pet ID page
                </label>

                <button
                  className="button"
                  style={{ marginTop: 12 }}
                  onClick={addVisit}
                  disabled={visitSaving}
                >
                  {visitSaving ? "Saving..." : "Save visit record"}
                </button>
              </div>
            )}

            {visitMessage && (
              <div
                className={
                  visitMessage.includes("successfully")
                    ? "status"
                    : "status warning"
                }
                style={{ marginTop: 12 }}
              >
                {visitMessage}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
