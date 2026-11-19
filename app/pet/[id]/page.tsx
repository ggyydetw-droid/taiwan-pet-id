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
