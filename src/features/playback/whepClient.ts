/**
 * WHEP (WebRTC-HTTP Egress Protocol) client — connects to a Cloudflare
 * Stream WHEP endpoint for sub-second-latency live playback. The backend
 * (amoria-connect) dropped HLS in favor of WHEP-only streaming, so this is
 * now the only playback path for live events. Ported from knockout's
 * proven implementation (knockout/lib/streaming/WHEPClient.ts) — same
 * reconnect/stall-watchdog behavior, just relocated for smartTv's player.
 */
export class WHEPClient {
    private peerConnection: RTCPeerConnection | null = null;
    private endpoint: string;
    private videoElement: HTMLVideoElement;
    private resourceUrl: string | null = null;
    private remoteStream: MediaStream;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 999; // effectively unbounded; we never stop trying
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private destroyed = false;
    // Stall detector — peerConnection.connectionState stays 'connected'
    // even when the upstream encoder has stopped sending frames (CF keeps
    // the WebRTC session warm so a reconnecting encoder can resume into
    // it). We need a stat-based watchdog: if bytesReceived on the inbound
    // video RTP doesn't grow for >5 s while we think we're connected, the
    // source dropped silently and we have to tear this peer down and
    // re-negotiate fresh.
    private statsTimer: ReturnType<typeof setInterval> | null = null;
    private lastBytesReceived = 0;
    private lastByteAdvanceAt = 0;
    private static STALL_THRESHOLD_MS = 5000;

    constructor(endpoint: string, videoElement: HTMLVideoElement) {
        this.endpoint = endpoint;
        this.videoElement = videoElement;
        this.remoteStream = new MediaStream();
        this.connect();
    }

    private async connect(): Promise<void> {
        if (this.destroyed) return;

        try {
            // 1. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
                bundlePolicy: 'max-bundle',
            });

            // 2. Add receive-only transceivers BEFORE creating offer
            this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
            this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

            // 3. Collect remote tracks into a MediaStream
            this.remoteStream = new MediaStream();
            this.peerConnection.ontrack = (event) => {
                this.remoteStream.addTrack(event.track);
                // Attach stream to video element as tracks arrive
                if (this.videoElement.srcObject !== this.remoteStream) {
                    this.videoElement.srcObject = this.remoteStream;
                }
            };

            // Monitor connection state for reconnection
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection?.connectionState;
                if (state === 'failed' || state === 'disconnected') {
                    this.handleDisconnect();
                }
                if (state === 'connected') {
                    this.reconnectAttempts = 0;
                    // Connected - arm the stat-based stall watchdog now that we
                    // have a peer that can produce inbound RTP stats.
                    this.startStallWatchdog();
                }
            };

            // 4. Create offer
            const offer = await this.peerConnection.createOffer();
            if (!this.peerConnection || this.destroyed) return;
            await this.peerConnection.setLocalDescription(offer);

            // 5. Wait for ICE gathering (max 3s)
            await this.waitForIceGathering(3000);
            if (!this.peerConnection || this.destroyed) return;

            const localDescription = this.peerConnection.localDescription;
            if (!localDescription) throw new Error('No local description');

            // 6. POST offer SDP to the WHEP URL (plain fetch, no credentials)
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: localDescription.sdp,
            });

            if (!response.ok) {
                throw new Error(`WHEP negotiation failed: ${response.status} ${response.statusText}`);
            }

            // Store resource URL for teardown
            const location = response.headers.get('Location');
            if (location) {
                this.resourceUrl = new URL(location, this.endpoint).toString();
            }

            // 7. Set the answer
            const answerSdp = await response.text();
            if (!this.peerConnection || this.destroyed) return;
            await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            // 8. Attach to video element and play
            this.videoElement.srcObject = this.remoteStream;
            this.videoElement.muted = true; // autoplay requires muted
            await this.videoElement.play().catch(() => {});
        } catch (error) {
            console.error('[WHEPClient] Connection error:', error);
            this.handleDisconnect();
        }
    }

    private waitForIceGathering(timeout: number): Promise<void> {
        return new Promise((resolve) => {
            if (!this.peerConnection) {
                resolve();
                return;
            }
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
                return;
            }

            const timer = setTimeout(resolve, timeout);

            this.peerConnection.addEventListener('icegatheringstatechange', () => {
                if (this.peerConnection?.iceGatheringState === 'complete') {
                    clearTimeout(timer);
                    resolve();
                }
            });
        });
    }

    private handleDisconnect(): void {
        if (this.destroyed) return;

        this.stopStallWatchdog();

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Capped exponential backoff that tops out at 5 s, so a reconnecting
            // encoder is picked up quickly.
            const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 3)), 5000);
            console.log(`[WHEPClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

            this.cleanupConnection();
            this.reconnectTimer = setTimeout(() => this.connect(), delay);
        }
    }

    /** Start polling getStats() every 2s once the peer is connected.
     *  Looks at the first inbound video RTP stream's bytesReceived; if
     *  that hasn't grown for STALL_THRESHOLD_MS, force a reconnect. */
    private startStallWatchdog(): void {
        this.stopStallWatchdog();
        this.lastBytesReceived = 0;
        this.lastByteAdvanceAt = Date.now();
        this.statsTimer = setInterval(async () => {
            if (this.destroyed || !this.peerConnection) return;
            try {
                const stats = await this.peerConnection.getStats();
                let totalBytes = 0;
                stats.forEach((report) => {
                    // Track every inbound RTP stream (video + audio). Either one
                    // growing means the source is alive.
                    if (report.type === 'inbound-rtp') {
                        const r = report as RTCInboundRtpStreamStats & { bytesReceived?: number };
                        if (typeof r.bytesReceived === 'number') totalBytes += r.bytesReceived;
                    }
                });
                if (totalBytes > this.lastBytesReceived) {
                    this.lastBytesReceived = totalBytes;
                    this.lastByteAdvanceAt = Date.now();
                    return;
                }
                // No growth. If the peer claims to be connected and we've been
                // dry for >5 s, the upstream stopped sending - reconnect.
                const isConnected = this.peerConnection.connectionState === 'connected';
                if (isConnected && Date.now() - this.lastByteAdvanceAt > WHEPClient.STALL_THRESHOLD_MS) {
                    console.log('[WHEPClient] No inbound bytes for >5s — forcing reconnect');
                    this.handleDisconnect();
                }
            } catch {
                // getStats can throw if the peer is mid-transition; ignore.
            }
        }, 2000);
    }

    private stopStallWatchdog(): void {
        if (this.statsTimer) {
            clearInterval(this.statsTimer);
            this.statsTimer = null;
        }
    }

    private cleanupConnection(): void {
        if (this.peerConnection) {
            this.peerConnection.ontrack = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }

    /** Current WebRTC connection state, e.g. for a "reconnecting…" indicator. */
    getConnectionState(): string {
        return this.peerConnection?.connectionState || 'closed';
    }

    /** Disconnect and release all resources — call on unmount / video change. */
    destroy(): void {
        this.destroyed = true;

        this.stopStallWatchdog();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Send DELETE to WHEP resource URL to release server-side resources
        if (this.resourceUrl) {
            fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {});
            this.resourceUrl = null;
        }

        this.cleanupConnection();
        this.videoElement.srcObject = null;
    }
}

export default WHEPClient;
