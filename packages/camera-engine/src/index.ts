/**
 * @medu/camera-engine
 *
 * Camera integration engine: credential vaulting, network boundary
 * enforcement, RTSP/ONVIF providers, and real-time streaming primitives
 * used by the API's camera workers.
 */

export * from './types';
export { CredentialVault } from './credential-vault';
export type { VaultCredentials } from './credential-vault';
export { NetworkSecurity } from './network-security';
export type { NetworkSecurityOptions } from './network-security';
export { RtspProvider, OnvifProvider } from './providers';
export type { ProviderConnectionParams } from './providers';
export {
  BoundedFrameQueue,
  FrameSampler,
  CameraHealthTracker,
  FfmpegStreamIngester,
} from './streaming';
export type { CameraHealthSnapshot, CameraHealthStatus } from './streaming';
export {
  perceptualHash,
  hammingDistance,
  isSameScene,
  FrozenFrameTracker,
  type PerceptualHash,
} from './perceptual-hash';
