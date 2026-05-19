const runtimeInjection = () => {
  const codeToInject = `
    (() => {
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        console.warn("Data Privacy Guardian: Shielded active Canvas fingerprinting attempt.");
        const imageData = originalGetImageData.apply(this, [x, y, w, h]);
        imageData.data[0] = imageData.data[0] ^ 1; 
        return imageData;
      };
    })();
  `;

  const script = document.createElement('script');
  script.textContent = codeToInject;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

runtimeInjection();