import tls from 'node:tls';
import { debug } from './debug';

/**
 * OpenSSL 3.5+ (bundled with recent Node.js versions) enables the
 * post-quantum X25519MLKEM768 key share by default. The bigger ClientHello
 * spans multiple TCP segments, which some middleboxes (routers, VPNs,
 * security software) cannot parse — they reset the connection (ECONNRESET).
 *
 * Falling back to classic groups restores connectivity. The value is read at
 * connect time, so retried requests pick it up on their next socket.
 */
const CLASSIC_TLS_GROUPS = 'X25519:P-256:P-384:P-521';

let applied = false;

export const applyClassicTlsGroupsFallback = (): boolean => {
  if (applied) return false;
  applied = true;

  tls.DEFAULT_ECDH_CURVE = CLASSIC_TLS_GROUPS;
  debug(
    'Connection reset detected: falling back to classic TLS groups (disabling post-quantum key share) for subsequent requests'
  );

  return true;
};
