# M-EDU — Biometrics: Model Versioning

## WHAT

Every template is bound to the exact model/preprocessing that produced it;
incompatible embeddings are never compared.

## WHY

If the embedding model changes silently, old and new templates would be
mathematically incompatible — old identities would fail or, worse, collide
with new ones. Versioning makes incompatibility explicit and safe.

## HOW

- `EmbeddingModelInfo { modelName, modelVersion, embeddingDimension,
  preprocessingVersion }` — `versionKey = modelName-modelVersion-
  preprocessingVersion`.
- `FaceEmbedding.cosineSimilarity` returns **0** when `versionKey` differs —
  no cross-version comparison, ever.
- `FaceRecord` stores signature metadata (source, sample count, timestamps);
  the geometric `FaceSignature` (mlkit-contour / tflite-facemesh) is the
  current template mechanism, with the same principle applied via `source`.
- `BiometricPolicy.version` — configuration version; threshold changes bump
  it so decisions are attributable to a known policy.

## Migration / re-enrollment

When the model changes:

1. Ship the new engine; old templates remain stored but cannot match under
   the new model (version guard).
2. Trigger **re-enrollment** for affected identities (`ReEnrollFaceIdentity`
   flow — re-run `face_enroll_page` for the student).
3. Audit history is preserved; old biometric data is removed per retention
   policy — never silently overwritten without trace.

## Honest limits

The current template is a geometric signature (not a deep embedding);
`FaceEmbedding`/MobileFaceNet-class deep embeddings are supported by the
abstraction (`FaceEmbeddingService` interface) but the geometric path is the
one in production today. A model switch would follow this versioning
protocol.
