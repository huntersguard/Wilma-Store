/**
 * Image compression utility to ensure product photos never exceed
 * browser LocalStorage quota or Firestore 1MB document limit.
 * Converts 5MB-15MB camera photos into crisp ~20KB-35KB thumbnails.
 */
export async function compressProductImage(
  source: File | string,
  maxWidth = 480,
  maxHeight = 480,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const processImage = () => {
        let width = img.naturalWidth || img.width || 300;
        let height = img.naturalHeight || img.height || 300;

        // Calculate aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        // Fill white background in case of PNG transparency
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Export as compressed JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onload = processImage;
      img.onerror = () => {
        console.warn('Image load error during compression, using fallback');
        resolve(typeof source === 'string' ? source : '');
      };

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            img.src = e.target.result as string;
          } else {
            resolve('');
          }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(source);
      }
    } catch (err) {
      console.warn('Exception during image compression:', err);
      resolve(typeof source === 'string' ? source : '');
    }
  });
}
