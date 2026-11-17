"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PublicPet = {
  id: string;
  name?: string;
  city?: string;
  contact?: string;
};

export default function PublicPetPage() {
  const params = useParams<{ petId: string }>();
  const [pet, setPet] = useState<PublicPet | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const values = new URLSearchParams(hash);
    setPet({
      id: values.get("id") || params.petId,
      name: values.get("name") || undefined,
      city: values.get("city") || undefined,
      contact: values.get("contact") || undefined,
    });
  }, [params.petId]);

  if (!pet) {
    return <main className="page"><div className="card"><p>Loading pet ID…</p></div></main>;
  }

  return (
    <main className="page">
      <div className="card">
        <p style={{ color: "#1f6b4b", fontWeight: 800 }}>🐾 Taiwan Pet ID</p>
        <h1>{pet.name ? pet.name : "Verified Pet ID"}</h1>
        <div className="status">Government verification ID: {pet.id}</div>

        <div style={{ marginTop: 24 }}>
          {pet.name && <p><strong>Pet name:</strong> {pet.name}</p>}
          {pet.city && <p><strong>City:</strong> {pet.city}</p>}
          {pet.contact && <p><strong>Owner contact:</strong> {pet.contact}</p>}
        </div>

        <p style={{ marginTop: 28, color: "#5c6862" }}>
          This public page shows only information selected by the owner when the QR was created.
        </p>
      </div>
    </main>
  );
}
