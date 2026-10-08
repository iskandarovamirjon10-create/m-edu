# Face test assets — provenance

These fixtures are used by the real ONNX integration tests in
`src/__tests__/`. They are committed so the tests do not depend on network
access and are deterministic.

| File | Content | Source | License |
| --- | --- | --- | --- |
| `image_T1.jpg` | Genuine live face (ground truth) | [minivision-ai/Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) upstream test set (`image_T1.jpg`) | Apache-2.0 (upstream repo) |
| `image_F1.jpg` | Printed-photo presentation attack (ground truth) | Same upstream test set (`image_F1.jpg`) | Apache-2.0 |
| `image_F2.jpg` | Screen-replay presentation attack (ground truth) | Same upstream test set (`image_F2.jpg`) | Apache-2.0 |
| `image_U1.jpg` | A **different person** (unknown/not-enrolled) | Wikimedia Commons, ["Monochrome woman face glitter (Unsplash)"](https://commons.wikimedia.org/wiki/File:Monochrome_woman_face_glitter_(Unsplash).jpg) by Matheus Ferrero | CC0 (public domain dedication, attribution not required) |

`image_U1.jpg` exists specifically so the recognition tests can prove that a
non-enrolled face is rejected as `UNKNOWN` instead of being forced onto the
only enrolled template.
