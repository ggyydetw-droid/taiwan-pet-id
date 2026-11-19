"use client";

import { useEffect, useState } from "react";

type PublicPet = {
  petId: string;
  name?: string;
  city?: string;
  contact?: string;
  lost?: boolean;
};

export default function PublicPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [pet, setPet] = useState<PublicPet | null>(null);
  const [error, setError] = useState("");
  const [showFoundForm, setShowFoundForm] = useState(false);
  const [finderName, setFinderName] = useState("");
  const [finderContact, setFinderContact] = useState("");
  const [finderMessage, setFinderMessage] = useState("");
  const [foundLocation, setFoundLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [foundSaving, setFoundSaving] = useState(false);
  const [foundSaved, setFoundSaved] = useState(false);
  const [foundError, setFoundError] = useState("");

  useEffect(() => {
    params.then(({ id }) =>
      fetch(`/api/pets/${encodeURIComponent(id)}?t=${Date.now()}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Unable to load pet.");
          setPet(data);
        })
        .catch((err) => setError(err.message))
    );
  }, [params]);

  async function reportFound() {
    setFoundSaving(true);
    setFoundSaved(false);
    setFoundError("");

    try {
      const { id } = await params;
      const response = await fetch(
        `/api/pets/${encodeURIComponent(id)}/found`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            finderName,
            finderContact,
            message: finderMessage,
            foundLocation,
          }),
        }
      );

      const responseText = await response.text();
      let data: { message?: string; saved?: boolean } = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            `The server returned an invalid response (HTTP ${response.status}). Please try again after the deployment finishes.`
          );
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Unable to send report (HTTP ${response.status}).`);
      }

      setFoundSaved(true);
      setFinderMessage("");
    } catch (err) {
      setFoundError(
        err instanceof Error ? err.message : "Unable to send report."
      );
    } finally {
      setFoundSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        {error ? (
          <>
            <h1>Pet ID not found</h1>
            <p>{error}</p>
          </>
        ) : !pet ? (
          <p>Loading public pet ID…</p>
        ) : (
          <>
            <p>🐾 Taiwan Pet ID</p>
            <h1>{pet.name ? `${pet.name}'s Public Pet ID` : "Public Pet ID"}</h1>
            {pet.lost && (
              <div
                className="status warning"
                style={{
                  marginBottom: 16,
                  border: "2px solid #b91c1c",
                  fontWeight: 800,
                  textAlign: "center",
                }}
              >
                🚨 LOST PET
                <br />
                This pet has been reported lost. If you found this pet, please contact the owner.
              </div>
            )}

            {pet.lost && (
              <section style={{ marginTop: 20 }}>
                <button
                  className="button"
                  onClick={() => setShowFoundForm(value => !value)}
                >
                  {showFoundForm ? "Close found-pet form" : "🐾 I found this pet"}
                </button>

                {showFoundForm && (
                  <div className="status" style={{ marginTop: 12 }}>
                    <h2>Help reunite this pet</h2>
                    <p>
                      Send the owner a message. Your contact details are only shared with the owner.
                    </p>

                    <div className="field">
                      <label>Your name (optional)</label>
                      <input
                        value={finderName}
                        onChange={e => setFinderName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>

                    <div className="field">
                      <label>Your phone or email</label>
                      <input
                        value={finderContact}
                        onChange={e => setFinderContact(e.target.value)}
                        placeholder="How can the owner contact you?"
                      />
                    </div>

                    <div className="field">
                      <label>Where did you find the pet? (optional)</label>
                      <input
                        value={foundLocation}
                        onChange={e => setFoundLocation(e.target.value)}
                        placeholder="Enter a place or address"
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button
                          type="button"
                          className="button"
                          disabled={locating}
                          onClick={() => {
                            if (!navigator.geolocation) {
                              setFoundError("Location is not supported on this device.");
                              return;
                            }
                            setLocating(true);
                            navigator.geolocation.getCurrentPosition(
                              position => {
                                setFoundLocation(
                                  `Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
                                );
                                setLocating(false);
                              },
                              () => {
                                setFoundError("Unable to get your location. You can enter the place manually.");
                                setLocating(false);
                              },
                              { enableHighAccuracy: true, timeout: 10000 }
                            );
                          }}
                        >
                          {locating ? "Getting location..." : "📍 Use my current location"}
                        </button>
                        <button
                          type="button"
                          className="button"
                          onClick={() => setFoundLocation("")}
                        >
                          Clear location
                        </button>
                      </div>
                      <p style={{ fontSize: 13, marginTop: 8 }}>
                        You can type a place/address or use your device location.
                      </p>
                    </div>

                    <div className="field">
                      <label>Message</label>
                      <textarea
                        value={finderMessage}
                        onChange={e => setFinderMessage(e.target.value)}
                        placeholder="I found Milo near Taoyuan station..."
                        rows={4}
                      />
                    </div>

                    <button
                      className="button"
                      onClick={reportFound}
                      disabled={foundSaving}
                    >
                      {foundSaving ? "Sending..." : "Send to owner"}
                    </button>

                    {foundSaved && (
                      <div className="status" style={{ marginTop: 12 }}>
                        Thank you. Your report was sent to the pet owner.
                      </div>
                    )}

                    {foundError && (
                      <div className="status warning" style={{ marginTop: 12 }}>
                        {foundError}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <div className="status">
              <strong>Verified Pet ID</strong>
              <br />
              {pet.petId}
            </div>

            {pet.name && (
              <section style={{ marginTop: 24 }}>
                <h2>Pet</h2>
                <p>{pet.name}</p>
              </section>
            )}

            {pet.city && (
              <section style={{ marginTop: 16 }}>
                <h2>City</h2>
                <p>{pet.city}</p>
              </section>
            )}

            {pet.contact && (
              <section style={{ marginTop: 16 }}>
                <h2>Owner contact</h2>
                <p>{pet.contact}</p>
              </section>
            )}

            <p style={{ marginTop: 32, fontSize: 14 }}>
              Only information selected by the owner is shown on this public page.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
