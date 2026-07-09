// routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

function getContainerClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
        throw new Error(
            'AZURE_STORAGE_CONNECTION_STRING is not configured. ' +
            'Add it in Azure Portal → App Service → Configuration → Application settings.'
        );
    }
    const containerName = process.env.AZURE_STORAGE_CONTAINER || 'project-files';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    return blobServiceClient.getContainerClient(containerName);
}

// LIST all files in the container
router.get('/', async (req, res) => {
    try {
        const containerClient = getContainerClient();
        const files = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            files.push({
                name: blob.name,
                sizeKB: (blob.properties.contentLength / 1024).toFixed(1),
                lastModified: blob.properties.lastModified,
                url: `${containerClient.url}/${blob.name}`
            });
        }
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPLOAD a file
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    try {
        const containerClient = getContainerClient();
        const blobName = `${Date.now()}-${req.file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(req.file.buffer, {
            blobHTTPHeaders: { blobContentType: req.file.mimetype }
        });
        res.status(201).json({
            message: 'File uploaded successfully',
            fileName: blobName,
            url: blockBlobClient.url
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a file
router.delete('/:filename', async (req, res) => {
    try {
        const containerClient = getContainerClient();
        const blockBlobClient = containerClient.getBlockBlobClient(req.params.filename);
        await blockBlobClient.deleteIfExists();
        res.json({ message: 'File deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
