export function setupDownloadVideo(downloadBtn, player) {
  if (!downloadBtn) return;
  
  downloadBtn.addEventListener('click', () => {
    const videoSrc = player.src;
    
    if (!videoSrc) {
      console.error('No video source found');
      return;
    }
    
    const a = document.createElement('a');
    a.href = videoSrc;
    
    const urlParts = videoSrc.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    if (!filename.includes('.')) {
      filename += '.mp4';
    }
    
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}