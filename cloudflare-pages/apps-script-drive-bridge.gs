/**
 * Exam Cracker Google Apps Script Drive bridge (no shared-secret mode).
 *
 * Deploy as a Web App: Execute as "Me"; access "Anyone".
 * Configure Script Property:
 *   EXAM_CRACKER_FOLDER_ID = the one permitted destination folder ID
 *
 * The folder is fixed server-side: callers cannot choose another Drive folder.
 * Uploads are limited to approved image/PDF MIME types and 20 MB. Files remain
 * private by default; never set ANYONE_WITH_LINK for student profile photos.
 *
 * Note: because this endpoint has no shared secret, anyone who discovers its
 * URL can attempt uploads into this single folder. Keep the URL only in the
 * Cloudflare Worker secret and monitor Drive storage usage.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var props = PropertiesService.getScriptProperties();
    var allowedFolderId = String(props.getProperty("EXAM_CRACKER_FOLDER_ID") || "").trim();
    if (!allowedFolderId) {
      return jsonOutput({ status: "error", message: "Server folder configuration is missing." });
    }

    var requestedFolderId = String(body.folderId || "").trim();
    if (requestedFolderId && requestedFolderId !== allowedFolderId) {
      return jsonOutput({ status: "error", message: "Folder is not allowlisted." });
    }

    var folder = DriveApp.getFolderById(allowedFolderId);
    if (body.action === "status") {
      var probe = folder.createFile(
        ".exam-cracker-write-probe-" + new Date().getTime(),
        "temporary write check",
        MimeType.PLAIN_TEXT
      );
      probe.setTrashed(true);
      return jsonOutput({ status: "success", folderName: folder.getName(), canAddChildren: true });
    }
    if (body.action !== "upload") {
      return jsonOutput({ status: "error", message: "Unsupported action." });
    }

    var fileName = String(body.fileName || "upload")
      .replace(/[\\/\x00-\x1f]/g, "_")
      .slice(0, 180);
    var fileType = String(body.fileType || "").toLowerCase().trim().slice(0, 120);
    var purpose = String(body.purpose || "").toLowerCase().trim();
    var allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    var allowedTypes = purpose === "profile_photo"
      ? allowedImageTypes
      : purpose === "pdf"
        ? ["application/pdf"]
        : [];

    if (!allowedTypes.includes(fileType)) {
      return jsonOutput({ status: "error", message: "This file type is not allowed for the requested upload purpose." });
    }

    var encoded = String(body.base64Data || "");
    if (!encoded || encoded.length > 28000000) {
      return jsonOutput({ status: "error", message: "File data is empty or exceeds the upload limit." });
    }
    var bytes = Utilities.base64Decode(encoded);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
      return jsonOutput({ status: "error", message: "File must be between 1 byte and 20 MB." });
    }

    // Check file signatures instead of trusting the browser-supplied MIME type.
    var normalizedBytes = bytes.map(function (b) { return (b + 256) % 256; });
    var first = normalizedBytes.slice(0, 8);
    var validImage = (
      (fileType === "image/jpeg" && first.length >= 3 && first[0] === 255 && first[1] === 216 && first[2] === 255) ||
      (fileType === "image/png" && first.length >= 8 && first[0] === 137 && first[1] === 80 && first[2] === 78 && first[3] === 71 && first[4] === 13 && first[5] === 10 && first[6] === 26 && first[7] === 10) ||
      (fileType === "image/gif" && String.fromCharCode.apply(null, first.slice(0, 3)) === "GIF") ||
      (fileType === "image/webp" && normalizedBytes.length >= 12 && String.fromCharCode.apply(null, normalizedBytes.slice(0, 4)) === "RIFF" && String.fromCharCode.apply(null, normalizedBytes.slice(8, 12)) === "WEBP")
    );
    var validPdf = fileType === "application/pdf" &&
      bytes.length >= 5 &&
      String.fromCharCode.apply(null, normalizedBytes.slice(0, 5)) === "%PDF-";
    if (!(validImage || validPdf)) {
      return jsonOutput({ status: "error", message: "The file contents do not match an allowed image or PDF type." });
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

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
