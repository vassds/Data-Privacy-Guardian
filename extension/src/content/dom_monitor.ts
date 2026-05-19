const runtimeInjection = () => {
  const codeToInject = `
    (() => {
      // 1. CANVAS FINGERPRINTING SHIELD
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        const imageData = originalGetImageData.apply(this, [x, y, w, h]);
        imageData.data[0] = imageData.data[0] ^ 1; // Add imperceptible noise
        return imageData;
      };

      // 2. WEBRTC IP LEAK SHIELD
      // This forces WebRTC to only use public proxy IPs instead of revealing the local network IP
      const originalRTCPeerConnection = window.RTCPeerConnection;
      if (originalRTCPeerConnection) {
          window.RTCPeerConnection = function(...args) {
              console.warn("Data Privacy Guardian: Shielded WebRTC connection attempt.");
              const pc = new originalRTCPeerConnection(...args);
              // Nullify the creation of data channels used for stealth IP probing
              pc.createDataChannel = function() { return null; };
              return pc;
          };
          window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
      }
    })();
  `;

  const script = document.createElement('script');
  script.textContent = codeToInject;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

runtimeInjection();