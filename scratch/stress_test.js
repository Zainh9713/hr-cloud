const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 1. Load environment variables manually from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      envConfig[key] = value;
      process.env[key] = value;
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/handrcloud';
const JWT_SECRET = process.env.JWT_SECRET || 'default_super_secret_key_for_dev';
const BASE_URL = 'http://localhost:3000';
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk slices
const TEMP_DIR = path.join(__dirname, 'temp_test_files');

// Mongoose Models
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  storageLimit: { type: Number, default: 5 * 1024 * 1024 * 1024 },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const StorageStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  totalLimit: { type: Number, required: true, default: 5 * 1024 * 1024 * 1024 },
  usedStorage: { type: Number, required: true, default: 0 },
  lastCalculated: { type: Date, default: Date.now },
}, { timestamps: true });
const StorageStats = mongoose.models.StorageStats || mongoose.model('StorageStats', StorageStatsSchema);

// Helper: MD5 Checksum
function getMD5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function getFileMD5(filePath) {
  const buffer = fs.readFileSync(filePath);
  return getMD5(buffer);
}

// Helper: Generate Random Buffer
function generateRandomBuffer(size) {
  return crypto.randomBytes(size);
}

// Setup Test Environment
async function setupTestUser() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to database.');

  const email = 'stress-test@example.com';
  let user = await User.findOne({ email });

  if (!user) {
    console.log('Creating test user stress-test@example.com...');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('password123', salt);
    user = await User.create({
      name: 'Stress Test Operator',
      email,
      password: hashedPassword,
      storageLimit: 10 * 1024 * 1024 * 1024 // 10GB limit
    });
    
    await StorageStats.create({
      userId: user._id,
      totalLimit: 10 * 1024 * 1024 * 1024,
      usedStorage: 0
    });
    console.log('Test user created.');
  } else {
    console.log('Test user stress-test@example.com already exists.');
  }

  // Generate JWT token
  const token = jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  return { token, userId: user._id.toString() };
}

// Generate files for testing
function generateTestFiles() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  console.log('Generating test files in scratch/temp_test_files...');
  
  // 1MB File (small)
  const file1MB = path.join(TEMP_DIR, 'file_1MB.bin');
  fs.writeFileSync(file1MB, generateRandomBuffer(1 * 1024 * 1024));
  
  // 10MB File (medium)
  const file10MB = path.join(TEMP_DIR, 'file_10MB.bin');
  fs.writeFileSync(file10MB, generateRandomBuffer(10 * 1024 * 1024));

  // 100MB File (large)
  const file100MB = path.join(TEMP_DIR, 'file_100MB.bin');
  fs.writeFileSync(file100MB, generateRandomBuffer(100 * 1024 * 1024));

  // 1.5MB PDF file (dummy PDF)
  const filePDF = path.join(TEMP_DIR, 'dummy_report.pdf');
  fs.writeFileSync(filePDF, generateRandomBuffer(1.5 * 1024 * 1024));

  // 500KB Image file (dummy PNG)
  const filePNG = path.join(TEMP_DIR, 'dummy_avatar.png');
  fs.writeFileSync(filePNG, generateRandomBuffer(500 * 1024));

  console.log('Files generated successfully.');
}

// Clean up temporary local test files
function cleanupLocalFiles() {
  if (fs.existsSync(TEMP_DIR)) {
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEMP_DIR, file));
    }
    fs.rmdirSync(TEMP_DIR);
    console.log('Temporary test files cleaned up locally.');
  }
}

// Upload dynamic chunk helper
async function uploadChunk(token, uploadId, chunkIndex, chunkBuffer) {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', chunkIndex.toString());
  formData.append('chunk', new Blob([chunkBuffer]), `chunk_${chunkIndex}`);

  const res = await fetch(`${BASE_URL}/api/files/upload-chunk`, {
    method: 'POST',
    headers: {
      'Cookie': `token=${token}`
    },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Upload chunk ${chunkIndex} failed with status ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// Initialize session helper
async function initSession(token, fileName, fileSize, fileHash) {
  const initUrl = `${BASE_URL}/api/files/upload-chunk?fileName=${encodeURIComponent(fileName)}&fileSize=${fileSize}&hash=${fileHash}&folderId=null`;
  const res = await fetch(initUrl, {
    headers: {
      'Cookie': `token=${token}`
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Init upload session failed: ${res.statusText}`);
  }
  return data;
}

// Merge chunks helper
async function mergeChunks(token, uploadId, mimeType) {
  const res = await fetch(`${BASE_URL}/api/files/merge-chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    },
    body: JSON.stringify({ uploadId, mimeType })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Merge failed: ${JSON.stringify(data)}`);
  }
  return data;
}

// Verify physical file matching MD5
function verifyPhysicalFile(fileRecord, expectedMD5) {
  const physicalPath = fileRecord.path;
  console.log(`Checking physical file at: ${physicalPath}`);
  if (!fs.existsSync(physicalPath)) {
    throw new Error(`Physical file does not exist at ${physicalPath}`);
  }
  const actualMD5 = getFileMD5(physicalPath);
  if (actualMD5 !== expectedMD5) {
    throw new Error(`Checksum mismatch! Expected MD5: ${expectedMD5}, but got physical MD5: ${actualMD5}`);
  }
  console.log(`[VERIFIED] File integrity correct. MD5 matches: ${expectedMD5}`);
  return physicalPath;
}

// Test Case 1: Standard Upload (1MB)
async function testStandardUpload(token) {
  console.log('\n--- TEST CASE 1: Standard Upload (1MB) ---');
  const filePath = path.join(TEMP_DIR, 'file_1MB.bin');
  const fileName = 'file_1MB.bin';
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const fileHash = `h_${fileName}_${fileSize}_${Date.now()}`;
  const originalMD5 = getMD5(fileBuffer);

  console.log(`Initializing session for ${fileName}...`);
  const session = await initSession(token, fileName, fileSize, fileHash);
  const uploadId = session.uploadId;
  console.log(`Session initialized. UploadId: ${uploadId}. Total chunks: ${session.totalChunks}`);

  // Upload chunk
  const chunkBuffer = fileBuffer.slice(0, CHUNK_SIZE);
  console.log(`Uploading chunk 0 (1MB)...`);
  await uploadChunk(token, uploadId, 0, chunkBuffer);

  // Merge
  console.log(`Merging file...`);
  const mergeResult = await mergeChunks(token, uploadId, 'application/octet-stream');
  console.log('File merged successfully:');
  console.log(JSON.stringify(mergeResult.file, null, 2));

  // Verify
  verifyPhysicalFile(mergeResult.file, originalMD5);
  return mergeResult.file;
}

// Test Case 2: Resumable Upload (10MB)
async function testResumableUpload(token) {
  console.log('\n--- TEST CASE 2: Resumable Upload (10MB - Pause & Resume) ---');
  const filePath = path.join(TEMP_DIR, 'file_10MB.bin');
  const fileName = 'file_10MB.bin';
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const fileHash = `h_${fileName}_${fileSize}_resumable_test`; // Fixed hash to resume session
  const originalMD5 = getMD5(fileBuffer);

  console.log(`Initializing session for ${fileName} (Phase 1)...`);
  let session = await initSession(token, fileName, fileSize, fileHash);
  const uploadId = session.uploadId;
  console.log(`Session initialized. UploadId: ${uploadId}. Total chunks: ${session.totalChunks}`);

  // Upload chunk 0 & 1
  console.log(`Uploading Chunk 0...`);
  await uploadChunk(token, uploadId, 0, fileBuffer.slice(0, CHUNK_SIZE));
  console.log(`Uploading Chunk 1...`);
  await uploadChunk(token, uploadId, 1, fileBuffer.slice(CHUNK_SIZE, CHUNK_SIZE * 2));

  console.log('Simulating Pause/Aborted Connection... (Halting Upload)');
  
  // Re-initialize the same session
  console.log(`Re-initializing session for ${fileName} (Phase 2 - Resuming)...`);
  session = await initSession(token, fileName, fileSize, fileHash);
  console.log(`Session resumed. UploadId: ${session.uploadId}`);
  console.log(`Uploaded chunks tracked by server: ${JSON.stringify(session.uploadedChunks)}`);
  
  if (!session.resumed || session.uploadedChunks.length !== 2 || !session.uploadedChunks.includes(0) || !session.uploadedChunks.includes(1)) {
    throw new Error(`Resumable session failed to properly restore uploaded chunks. Session data: ${JSON.stringify(session)}`);
  }
  console.log('[VERIFIED] Backend correctly kept the first 2 uploaded chunks.');

  // Upload remaining chunks
  for (let i = 2; i < session.totalChunks; i++) {
    console.log(`Uploading Chunk ${i}...`);
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    await uploadChunk(token, uploadId, i, fileBuffer.slice(start, end));
  }

  // Merge
  console.log(`Merging file...`);
  const mergeResult = await mergeChunks(token, uploadId, 'application/octet-stream');
  console.log('File reassembled successfully.');

  // Verify
  verifyPhysicalFile(mergeResult.file, originalMD5);
  return mergeResult.file;
}

// Test Case 3: Concurrent Chunk Uploads (10MB)
async function testConcurrentChunkUpload(token) {
  console.log('\n--- TEST CASE 3: Concurrent Chunk Uploads (10MB) ---');
  const filePath = path.join(TEMP_DIR, 'file_10MB.bin');
  const fileName = 'file_10MB.bin';
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const fileHash = `h_${fileName}_${fileSize}_concurrent_chunks_${Date.now()}`;
  const originalMD5 = getMD5(fileBuffer);

  console.log(`Initializing session for concurrent chunk upload...`);
  const session = await initSession(token, fileName, fileSize, fileHash);
  const uploadId = session.uploadId;
  console.log(`Session initialized. UploadId: ${uploadId}. Total chunks: ${session.totalChunks}`);

  // Upload chunks concurrently (2 at a time, mimicking frontend)
  const chunksQueue = Array.from({ length: session.totalChunks }, (_, i) => i);
  const activeUploads = [];

  console.log('Uploading chunks with concurrency limit 2...');
  
  const uploadNext = async () => {
    if (chunksQueue.length === 0) return;
    const index = chunksQueue.shift();
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    console.log(`[START] Chunk ${index}`);
    
    await uploadChunk(token, uploadId, index, fileBuffer.slice(start, end));
    console.log(`[COMPLETED] Chunk ${index}`);
    
    await uploadNext();
  };

  // Start two parallel execution chains
  activeUploads.push(uploadNext());
  activeUploads.push(uploadNext());
  await Promise.all(activeUploads);

  console.log('All concurrent chunks uploaded. Merging...');
  const mergeResult = await mergeChunks(token, uploadId, 'application/octet-stream');
  console.log('Reassembly complete.');

  verifyPhysicalFile(mergeResult.file, originalMD5);
  return mergeResult.file;
}

// Test Case 4: Large File Stability (100MB)
async function testLargeFileStability(token) {
  console.log('\n--- TEST CASE 4: Large File Stability (100MB) ---');
  const filePath = path.join(TEMP_DIR, 'file_100MB.bin');
  const fileName = 'file_100MB.bin';
  
  console.log('Reading 100MB test file from disk...');
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const fileHash = `h_${fileName}_${fileSize}_large_stability_${Date.now()}`;
  const originalMD5 = getMD5(fileBuffer);

  console.log(`Initializing session for 100MB file...`);
  const session = await initSession(token, fileName, fileSize, fileHash);
  const uploadId = session.uploadId;
  console.log(`Session initialized. UploadId: ${uploadId}. Total chunks: ${session.totalChunks}`);

  // Upload chunks concurrently (concurrency = 2)
  const chunksQueue = Array.from({ length: session.totalChunks }, (_, i) => i);
  const activeUploads = [];

  console.log(`Uploading 50 chunks (2MB each) with concurrency limit 2...`);
  
  const uploadNext = async () => {
    if (chunksQueue.length === 0) return;
    const index = chunksQueue.shift();
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    
    if (index % 10 === 0) {
      console.log(`Uploading Chunk ${index}/${session.totalChunks}...`);
    }
    
    await uploadChunk(token, uploadId, index, fileBuffer.slice(start, end));
    await uploadNext();
  };

  activeUploads.push(uploadNext());
  activeUploads.push(uploadNext());
  await Promise.all(activeUploads);

  console.log('100MB upload completed. Reassembling chunks...');
  const mergeResult = await mergeChunks(token, uploadId, 'application/octet-stream');
  console.log('Reassembly complete.');

  verifyPhysicalFile(mergeResult.file, originalMD5);
  return mergeResult.file;
}

// Test Case 5: Concurrent File Uploads (Multiple Files in Parallel)
async function testConcurrentFileUploads(token) {
  console.log('\n--- TEST CASE 5: Concurrent File Uploads (Multiple Files in Parallel) ---');
  
  const filePDFPath = path.join(TEMP_DIR, 'dummy_report.pdf');
  const filePNGPath = path.join(TEMP_DIR, 'dummy_avatar.png');

  const pdfBuffer = fs.readFileSync(filePDFPath);
  const pngBuffer = fs.readFileSync(filePNGPath);

  const originalPDFMD5 = getMD5(pdfBuffer);
  const originalPNGMD5 = getMD5(pngBuffer);

  console.log('Starting parallel uploads of PDF and Image files...');

  const uploadSingleFile = async (fileName, fileBuffer, mimeType) => {
    const size = fileBuffer.length;
    const fileHash = `h_${fileName}_${size}_parallel_${Date.now()}`;
    
    console.log(`[Parallel: ${fileName}] Initializing session...`);
    const session = await initSession(token, fileName, size, fileHash);
    const uploadId = session.uploadId;
    
    console.log(`[Parallel: ${fileName}] Uploading ${session.totalChunks} chunks...`);
    for (let i = 0; i < session.totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, size);
      await uploadChunk(token, uploadId, i, fileBuffer.slice(start, end));
    }
    
    console.log(`[Parallel: ${fileName}] Merging...`);
    const mergeResult = await mergeChunks(token, uploadId, mimeType);
    return mergeResult.file;
  };

  // Upload in parallel
  const [pdfResult, pngResult] = await Promise.all([
    uploadSingleFile('dummy_report.pdf', pdfBuffer, 'application/pdf'),
    uploadSingleFile('dummy_avatar.png', pngBuffer, 'image/png')
  ]);

  console.log('Parallel uploads complete. Verifying integrity...');
  verifyPhysicalFile(pdfResult, originalPDFMD5);
  verifyPhysicalFile(pngResult, originalPNGMD5);
  
  return [pdfResult, pngResult];
}

// Main Execution
async function runAllTests() {
  console.log('==================================================');
  console.log('    H&R CLOUD UPLOAD ENGINE STRESS TESTING TOOL   ');
  console.log('==================================================');
  
  const startTime = Date.now();
  let tokenInfo;
  
  try {
    // 1. Setup Test User
    tokenInfo = await setupTestUser();
    
    // 2. Generate Files
    generateTestFiles();

    // 3. Run Test Cases
    await testStandardUpload(tokenInfo.token);
    await testResumableUpload(tokenInfo.token);
    await testConcurrentChunkUpload(tokenInfo.token);
    await testConcurrentFileUploads(tokenInfo.token);
    await testLargeFileStability(tokenInfo.token);

    console.log('\n==================================================');
    console.log('    ALL UPLOAD SYSTEM VERIFICATIONS COMPLETED!    ');
    console.log('    STATUS: 100% STABLE                           ');
    console.log(`    TOTAL DURATION: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log('==================================================');
    
  } catch (err) {
    console.error('\n❌ STRESS TEST FAILURE:', err);
    process.exit(1);
  } finally {
    // Cleanup Mongoose connection and local temp files
    await mongoose.disconnect();
    cleanupLocalFiles();
  }
}

runAllTests();
