import * as fs from "fs";
import * as path from "path";

// Manually load .env.local variables FIRST before any code imports
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function runVerifications() {
  console.log("==================================================");
  console.log("  H&R CLOUD BACKEND SUBSYSTEM VERIFICATION SUITE  ");
  console.log("==================================================");

  let passed = true;

  try {
    // Dynamically import dependencies after env variables are set
    const connectDB = (await import("../src/lib/db")).default;
    const { FileService } = await import("../src/services/FileService");
    const { FolderService } = await import("../src/services/FolderService");
    const FileModel = (await import("../src/models/File")).default;
    const FolderModel = (await import("../src/models/Folder")).default;
    const UserModel = (await import("../src/models/User")).default;
    const { GeminiProvider } = await import("../src/lib/ai/GeminiProvider");
    const { GET } = await import("../src/app/storage/[userId]/[filename]/route");
    const mongoose = (await import("mongoose")).default;

    // Connect to database
    console.log("[DB] Connecting to MongoDB...");
    await connectDB();
    console.log("[DB] Connection successful.");

    // Create a temporary user for tests
    const testEmail = "verifier@handrcloud.internal";
    let testUser = await UserModel.findOne({ email: testEmail });
    if (!testUser) {
      testUser = await UserModel.create({
        name: "System Verifier",
        email: testEmail,
        password: "verifier_secure_pass_123",
        storageLimit: 10 * 1024 * 1024 * 1024
      });
      console.log(`[DB] Created test user: ${testEmail}`);
    } else {
      console.log(`[DB] Found existing test user: ${testEmail}`);
    }

    const userId = testUser._id.toString();

    // ----------------------------------------------------
    // TEST 1: Favorites/Starred Mongoose Validation Fix
    // ----------------------------------------------------
    console.log("\n[TEST 1] Favorites Toggle Schema Validation");
    
    // Create a temp file
    const tempFile = await FileModel.create({
      storedName: "temp_test_file.txt",
      originalName: "temp_test_file.txt",
      size: 100,
      mimeType: "text/plain",
      extension: ".txt",
      hash: "abc123hash",
      path: `./storage/${userId}/temp_test_file.txt`,
      ownerId: testUser._id,
      parentFolderId: null
    });
    console.log(`- Created temporary file record: ${tempFile.originalName} (${tempFile._id})`);

    // Call updateFile with only isStarred: true, omitting other required fields
    try {
      console.log("- Toggling star flag (isStarred = true)...");
      const updatedFile = await FileService.updateFile(userId, tempFile._id.toString(), {
        isStarred: true
      });
      
      if (updatedFile.isStarred === true) {
        console.log("✅ Starred file toggle validation PASS: File updated and saved successfully without errors!");
      } else {
        console.error("❌ Starred file toggle validation FAIL: isStarred value not true");
        passed = false;
      }
    } catch (err: any) {
      console.error("❌ Starred file toggle validation FAIL: Threw mongoose error: ", err.message);
      passed = false;
    }

    // Create a temp folder
    const tempFolder = await FolderModel.create({
      name: "Temp Test Folder",
      parentId: null,
      ownerId: testUser._id,
      color: "#ff00ff",
      icon: "folder"
    });
    console.log(`- Created temporary folder record: ${tempFolder.name} (${tempFolder._id})`);

    // Call updateFolder with isStarred: true
    try {
      console.log("- Toggling folder star flag (isStarred = true)...");
      const updatedFolder = await FolderService.updateFolder(userId, tempFolder._id.toString(), {
        isStarred: true
      });
      
      if (updatedFolder.isStarred === true) {
        console.log("✅ Starred folder toggle validation PASS: Folder updated and saved successfully without errors!");
      } else {
        console.error("❌ Starred folder toggle validation FAIL: isStarred value not true");
        passed = false;
      }
    } catch (err: any) {
      console.error("❌ Starred folder toggle validation FAIL: Threw mongoose error: ", err.message);
      passed = false;
    }

    // Cleanup DB records
    await FileModel.deleteOne({ _id: tempFile._id });
    await FolderModel.deleteOne({ _id: tempFolder._id });
    console.log("- Temporary test database records cleaned up.");

    // ----------------------------------------------------
    // TEST 2: AI Fallback Offline System
    // ----------------------------------------------------
    console.log("\n[TEST 2] AI Offline Fallback Behavior");
    const originalApiKey = process.env.GEMINI_API_KEY;
    // Force API Key to be empty to simulate offline mode
    delete process.env.GEMINI_API_KEY;

    const provider = new GeminiProvider();

    // Verify generateSummary offline mode
    const summaryRes = await provider.generateSummary(
      "test_document.pdf",
      "application/pdf",
      Buffer.from("dummy PDF data stream"),
      "Some text snippet to summarize"
    );

    console.log("- Testing summary fallback response...");
    if (summaryRes.summary.includes("[OFFLINE NEURAL ARCHIVE]") && summaryRes.tags.includes("local-archive")) {
      console.log("✅ generateSummary fallback PASS: Returned beautiful offline cyberpunk response!");
    } else {
      console.error("❌ generateSummary fallback FAIL: Summary did not contain expected offline header. Got:", summaryRes);
      passed = false;
    }

    // Verify chat offline mode
    const chatRes = await provider.chat(
      [{ role: "user", content: "Tell me about this document" }],
      "File content goes here",
      "Disk storage status okay"
    );

    console.log("- Testing chat fallback response...");
    if (chatRes.includes("[NEURAL CORE - LINK STATUS: OFFLINE]")) {
      console.log("✅ chat fallback PASS: Returned offline diagnostic recovery console message!");
    } else {
      console.error("❌ chat fallback FAIL: Chat response did not contain offline header. Got:", chatRes);
      passed = false;
    }

    // Verify embedding offline mode
    const embedding = await provider.generateEmbedding("Any arbitrary text input");
    console.log(`- Testing embedding fallback response (length: ${embedding.length})...`);
    if (embedding && embedding.length === 768) {
      console.log("✅ generateEmbedding fallback PASS: Returned 768-dimension mock vector!");
    } else {
      console.error("❌ generateEmbedding fallback FAIL: Embedding did not return mock vector of length 768. Got:", embedding?.length);
      passed = false;
    }

    // Verify semantic query parsing offline mode
    const parsedQuery = await provider.parseSemanticQuery("find pdf files larger than 10mb");
    console.log("- Testing query parsing fallback...");
    if (parsedQuery && parsedQuery.originalQuery === "find pdf files larger than 10mb") {
      console.log("✅ parseSemanticQuery fallback PASS: Safe keyword parsing fallback executed!");
    } else {
      console.error("❌ parseSemanticQuery fallback FAIL: Got:", parsedQuery);
      passed = false;
    }

    // Restore original API Key
    if (originalApiKey) {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    // ----------------------------------------------------
    // TEST 3: Static Serving Route and Security Traversal Protection
    // ----------------------------------------------------
    console.log("\n[TEST 3] Storage Static Serv Server & Directory Traversal Protection");

    // Let's test a malicious directory traversal URL parameter inside the route GET handler
    // We create a mock Request object and call the GET handler
    const makeParams = (uId: string, file: string) => {
      return Promise.resolve({ userId: uId, filename: file });
    };

    console.log("- Testing directory traversal attempt using relative path parent boundaries...");
    // Attempt traversal to '../secrets.txt'
    const traversalReq = new Request(`http://localhost:3000/storage/${userId}/../secrets.txt`);
    const traversalRes = await GET(traversalReq, { params: makeParams(userId, "../secrets.txt") });
    const traversalData = await traversalRes.json();

    if (traversalRes.status === 403 && traversalData.error.includes("Security Exception: Access Denied")) {
      console.log("✅ Path traversal protection PASS: Correctly blocked with HTTP 403 and access denied message!");
    } else {
      console.error(`❌ Path traversal protection FAIL: Server returned status ${traversalRes.status}:`, traversalData);
      passed = false;
    }

    console.log("- Testing non-existent file request...");
    const missingReq = new Request(`http://localhost:3000/storage/${userId}/missing_file.bin`);
    const missingRes = await GET(missingReq, { params: makeParams(userId, "missing_file.bin") });
    const missingData = await missingRes.json();

    if (missingRes.status === 404 && missingData.error.includes("File not found")) {
      console.log("✅ Missing file query PASS: Returned HTTP 404 cleanly.");
    } else {
      console.error(`❌ Missing file query FAIL: Server returned status ${missingRes.status}:`, missingData);
      passed = false;
    }

    // Disconnect Mongoose
    await mongoose.disconnect();
    console.log("\n[DB] Disconnected from MongoDB.");

  } catch (error: any) {
    console.error("❌ Verification Suite crashed due to unhandled error:", error);
    passed = false;
  }

  console.log("\n==================================================");
  if (passed) {
    console.log("      ALL SYSTEM BACKEND VERIFICATIONS PASSED!     ");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.log("   ⚠️ SOME BACKEND VERIFICATION CHECKS FAILED   ");
    console.log("==================================================");
    process.exit(1);
  }
}

runVerifications();
