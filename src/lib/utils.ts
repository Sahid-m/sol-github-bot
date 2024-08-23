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
