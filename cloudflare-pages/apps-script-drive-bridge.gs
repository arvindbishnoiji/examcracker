/**
 * Exam Cracker personal Gmail upload bridge.
 *
 * Deploy as a Web App: Execute as "Me"; access "Anyone".
 * Access is protected by EXAM_CRACKER_SHARED_SECRET and an allowlisted folder.
 * Set these Script Properties before deploying:
 *   EXAM_CRACKER_SHARED_SECRET = a long random secret
 *   EXAM_CRACKER_FOLDER_ID = the personal My Drive destination folder ID
 *
 * Never put the shared secret in HTML, GitHub, or a URL query string.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var props = PropertiesService.getScriptProperties();
    var expectedSecret = props.getProperty("EXAM_CRACKER_SHARED_SECRET") || "";
    var allowedFolderId = props.getProperty("EXAM_CRACKER_FOLDER_ID") || "";
    if (expectedSecret.length < 32 || !allowedFolderId || !constantTimeEquals(String(body.secret || ""), expectedSecret)) {
      return jsonOutput({ status: "error", message: "Unauthorized or server configuration missing." });
    }
    var folderId = String(body.folderId || "");
    if (folderId !== allowedFolderId) {
      return jsonOutput({ status: "error", message: "Folder is not allowlisted." });
    }
    var folder = DriveApp.getFolderById(allowedFolderId);
    if (body.action === "status") {
      var probe = folder.createFile(".exam-cracker-write-probe-" + new Date().getTime(), "temporary write check", MimeType.PLAIN_TEXT);
      probe.setTrashed(true);
      return jsonOutput({ status: "success", folderName: folder.getName(), canAddChildren: true });
    }
    if (body.action !== "upload") {
      return jsonOutput({ status: "error", message: "Unsupported action." });
    }
    var fileName = String(body.fileName || "upload").replace(/[\/\x00-\x1f]/g, "_").slice(0, 180);
    var fileType = String(body.fileType || "application/octet-stream").slice(0, 120);
    var encoded = String(body.base64Data || "");
    if (!encoded || encoded.length > 28000000) {
      return jsonOutput({ status: "error", message: "File data is empty or exceeds the upload limit." });
    }
    var bytes = Utilities.base64Decode(encoded);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
      return jsonOutput({ status: "error", message: "File must be between 1 byte and 20 MB." });
    }
    var blob = Utilities.newBlob(bytes, fileType, fileName);
    var file = folder.createFile(blob);
    return jsonOutput({
      status: "success",
      fileId: file.getId(),
      fileName: file.getName(),
      fileType: file.getMimeType(),
      sizeBytes: file.getSize()
    });
  } catch (error) {
    return jsonOutput({
      status: "error",
      message: String(error && error.message ? error.message : "Upload failed").slice(0, 300)
    });
  }
}

function constantTimeEquals(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  var mismatch = 0;
  for (var i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
