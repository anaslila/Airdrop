// QR Code generation library
class QRCodeGenerator {
    static generateQR(text, canvas, size = 200) {
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            ctx.drawImage(img, 0, 0, size, size);
        };
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    }
}

class AirDropApp {
    constructor() {
        this.initializeElements();
        this.baseUrl = window.location.origin + window.location.pathname.replace(/\/+$/, '');
        
        // Check if this is a download link first
        const urlParams = new URLSearchParams(window.location.search);
        const uploadId = urlParams.get('id');
        
        if (uploadId) {
            this.showDownloadPage(uploadId);
        } else {
            this.attachEventListeners();
            this.resetApp(); // Ensure upload section is shown if no ID
        }
        
        this.registerServiceWorker();
    }

    initializeElements() {
        this.uploadBox = document.getElementById('uploadBox');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadSection = document.getElementById('uploadSection');
        this.shareSection = document.getElementById('shareSection');
        this.downloadSection = document.getElementById('downloadSection');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.qrCanvas = document.getElementById('qrCanvas');
        this.shareLink = document.getElementById('shareLink');
        this.copyBtn = document.getElementById('copyBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.newShareBtn = document.getElementById('newShareBtn');
        this.downloadFileInfo = document.getElementById('downloadFileInfo');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
        this.goHomeBtn = document.getElementById('goHomeBtn');
        this.toast = document.getElementById('toast');
    }

    attachEventListeners() {
        // File upload events
        this.uploadBox.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());

        // Drag and drop events
        this.uploadBox.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadBox.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadBox.addEventListener('drop', this.handleDrop.bind(this));

        // Share events
        this.copyBtn.addEventListener('click', this.copyLink.bind(this));
        this.newShareBtn.addEventListener('click', this.resetApp.bind(this));

        // Download events (attached in showDownloadPage to ensure correct context)
        // Removed global listeners to prevent multiple attachments
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadBox.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadBox.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadBox.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
    }

    async handleFiles(files) {
        if (!files || files.length === 0) return;

        this.showProgress();
        
        try {
            const uploadId = this.generateUploadId();
            const fileData = await this.processFiles(files);
            
            // Store files in localStorage with expiry
            const uploadData = {
                files: fileData,
                timestamp: Date.now(),
                id: uploadId,
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            
            localStorage.setItem(`airdrop_${uploadId}`, JSON.stringify(uploadData));

            this.showShareSection(uploadId, Array.from(files));
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('Upload failed. Please try again.');
            this.hideProgress();
        }
    }

    async processFiles(files) {
        const fileData = [];
        let completed = 0;

        for (const file of files) {
            try {
                const base64 = await this.fileToBase64(file);
                fileData.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: base64, // Base64 content for download
                    lastModified: file.lastModified
                });

                completed++;
                this.updateProgress((completed / files.length) * 100);
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                this.showToast(`Error processing file: ${file.name}`);
            }
        }

        return fileData;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    generateUploadId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    showProgress() {
        this.progressBar.style.display = 'block';
        this.uploadBtn.disabled = true;
        this.uploadBtn.textContent = 'Uploading...';
    }

    updateProgress(percent) {
        this.progressFill.style.width = `${percent}%`;
    }

    hideProgress() {
        this.progressBar.style.display = 'none';
        this.uploadBtn.disabled = false;
        this.uploadBtn.textContent = 'Choose Files';
    }

    showShareSection(uploadId, files) {
        this.hideProgress();
        this.uploadSection.style.display = 'none';
        this.shareSection.style.display = 'block';
        this.downloadSection.style.display = 'none'; // Hide download section

        const shareUrl = `${this.baseUrl}?id=${uploadId}`;
        this.shareLink.value = shareUrl;

        QRCodeGenerator.generateQR(shareUrl, this.qrCanvas, 200);
        this.displayFileInfo(files);
    }

    showDownloadPage(uploadId) {
        const storedData = localStorage.getItem(`airdrop_${uploadId}`);
        
        if (!storedData) {
            this.showToast('Files not found or expired');
            this.goHome();
            return;
        }

        try {
            const uploadData = JSON.parse(storedData);
            
            // Check if expired
            if (Date.now() > uploadData.expires) {
                localStorage.removeItem(`airdrop_${uploadId}`);
                this.showToast('Files have expired');
                this.goHome();
                return;
            }

            // Show download section
            this.uploadSection.style.display = 'none';
            this.shareSection.style.display = 'none';
            this.downloadSection.style.display = 'block';

            // Store current upload data for download
            this.currentDownloadData = uploadData;

            // Display file info
            this.displayDownloadFileInfo(uploadData.files);
            
            // Attach download events (ensure they are only attached once)
            // Remove previous listeners to avoid duplicates if navigating back and forth
            this.downloadAllBtn.removeEventListener('click', this.downloadAllFilesHandler);
            this.goHomeBtn.removeEventListener('click', this.goHomeHandler);

            this.downloadAllFilesHandler = this.downloadAllFiles.bind(this);
            this.goHomeHandler = this.goHome.bind(this);

            this.downloadAllBtn.addEventListener('click', this.downloadAllFilesHandler);
            this.goHomeBtn.addEventListener('click', this.goHomeHandler);

        } catch (error) {
            console.error('Error parsing upload data:', error);
            this.showToast('Error loading files');
            this.goHome();
        }
    }

    displayFileInfo(files) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const fileCount = files.length;

        let html = `<h4>Shared Files (${fileCount} ${fileCount === 1 ? 'file' : 'files'}, ${this.formatFileSize(totalSize)})</h4>`;

        files.forEach(file => {
            html += `
                <div class="file-item">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                </div>
            `;
        });

        this.fileInfo.innerHTML = html;
    }

    displayDownloadFileInfo(files) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const fileCount = files.length;

        let html = `<h4>Available Files (${fileCount} ${fileCount === 1 ? 'file' : 'files'}, ${this.formatFileSize(totalSize)})</h4>`;

        files.forEach((file, index) => {
            html += `
                <div class="file-item download-item">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                    <button class="download-single-btn" data-index="${index}">Download</button>
                </div>
            `;
        });

        this.downloadFileInfo.innerHTML = html;

        // Attach listeners for individual download buttons
        document.querySelectorAll('.download-single-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                this.downloadFile(index);
            });
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async copyLink() {
        try {
            await navigator.clipboard.writeText(this.shareLink.value);
            this.copyBtn.textContent = 'Copied!';
            this.copyBtn.classList.add('copied');
            this.showToast('Link copied to clipboard!');
            
            setTimeout(() => {
                this.copyBtn.textContent = 'Copy Link';
                this.copyBtn.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showToast('Failed to copy link');
        }
    }

    downloadFile(index) {
        if (!this.currentDownloadData || !this.currentDownloadData.files[index]) {
            this.showToast('File not found for download');
            return;
        }
        const file = this.currentDownloadData.files[index];
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast(`Downloading: ${file.name}`);
    }

    downloadAllFiles() {
        if (!this.currentDownloadData || this.currentDownloadData.files.length === 0) {
            this.showToast('No files to download');
            return;
        }

        let downloadCount = 0;
        const totalFiles = this.currentDownloadData.files.length;

        this.currentDownloadData.files.forEach((file, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = file.data;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                downloadCount++;
                if (downloadCount === totalFiles) {
                    this.showToast(`Successfully downloaded ${totalFiles} file${totalFiles > 1 ? 's' : ''}!`);
                }
            }, index * 500); // Stagger downloads by 500ms
        });
    }

    resetApp() {
        this.uploadSection.style.display = 'block';
        this.shareSection.style.display = 'none';
        this.downloadSection.style.display = 'none';
        this.fileInput.value = ''; // Clear file input
        this.progressFill.style.width = '0%';
        window.history.pushState({}, '', this.baseUrl); // Clear URL params
    }

    goHome() {
        // Remove URL parameters and reload
        const url = new URL(window.location);
        url.search = '';
        window.location.href = url.toString(); // This will trigger a full page reload and reset the app
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('ServiceWorker registered successfully:', registration.scope);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    }

    // Clean up expired files periodically
    cleanupExpiredFiles() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('airdrop_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.expires && Date.now() > data.expires) {
                        localStorage.removeItem(key);
                        console.log(`Cleaned up expired file: ${key}`);
                    }
                } catch (error) {
                    console.error(`Error parsing or cleaning up localStorage key ${key}:`, error);
                    localStorage.removeItem(key); // Remove corrupted data
                }
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.airDropApp = new AirDropApp();
    
    // Cleanup expired files on load
    window.airDropApp.cleanupExpiredFiles();
});
