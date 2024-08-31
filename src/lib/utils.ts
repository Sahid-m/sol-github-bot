import crypto from "crypto";

export const IsBountyComment = (commentBody: string) => {
  return commentBody.startsWith("/bounty");
};

export const IsAttemptComment = (commentBody: string) => {
  return commentBody.startsWith("/attempt");
};

export const isRemoveComment = (commentBody: string) => {
  return commentBody.startsWith("/remove");
};

export const extractAmount = (comment: string) => {
  const bountyExtractor = /\/bounty\s+(\$?\d+|\d+\$)/;

  const match = comment.match(bountyExtractor);
  return match ? match[1] : null;
};

export function extractClaimNumber(comment: string): string | null {
  // Define the regular expression to match "/claim" followed by "#" and a number
  const claimRegex = /\/claim\s+#(\d+)/;

  // Attempt to match the regular expression against the input string
  const match = comment.match(claimRegex);

  // If a match is found, return the full "#number", otherwise return null
  return match ? `${match[1]}` : null;
}

export const extractSolPublicKey = (comment: string) => {
  // Define the regular expression to match "/try" followed by a Solana public key with optional spaces around
  const TryExtractor = /\/attempt\s*([1-9A-HJ-NP-Za-km-z]{32,44})\s*/;

  // Attempt to match the regular expression against the input string
  const match = comment.match(TryExtractor);

  // Return the captured Solana public key if a match is found, otherwise return null
  return match ? match[1] : null;
};

export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

interface EncryptionResult {
  encryptedData: string;
  key: string;
  iv: string;
}

export function encryptStrings(str1: string, str2: string): EncryptionResult {
  // Join the strings
  const data = `${str1}|${str2}`;

  // Generate a random encryption key
  const key = crypto.randomBytes(32).toString("hex");

  // Generate a random IV
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    iv
  );

  // Encrypt the data
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    encryptedData: encrypted,
    key: key,
    iv: iv.toString("hex"),
  };
}

export function decryptStrings(
  encryptedData: string,
  key: string,
  iv: string
): [string, string] {
  // Create decipher
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex")
  );

  // Decrypt the data
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  // Split the decrypted string back into two strings
  const [str1, str2] = decrypted.split("|");

  return [str1, str2];
}
