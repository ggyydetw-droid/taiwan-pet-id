# Taiwan Pet ID architecture

Government pet registration/microchip identity is the root identity. Taiwan Pet ID is the third-party digital identity and access layer.

Rules:
- One verified government reference maps to one Digital Pet ID.
- QR and NFC contain only an opaque public token.
- Owner personal information and veterinary records are not embedded in QR/NFC.
- Government connectivity must use an authorized third-party API/interface.
- The current API route is a sandbox and does not scrape or bypass the official system.

Business model:
- QR: free.
- NFC: optional paid hardware.
- Clinic premium features: later.
