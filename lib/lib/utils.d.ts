export declare const IsBountyComment: (commentBody: string) => boolean;
export declare const IsAttemptComment: (commentBody: string) => boolean;
export declare const isRemoveComment: (commentBody: string) => boolean;
export declare const extractAmount: (comment: string) => string | null;
export declare function extractClaimNumber(comment: string): string | null;
export declare const extractSolPublicKey: (comment: string) => string | null;
export declare function generateToken(): string;
interface EncryptionResult {
    encryptedData: string;
    key: string;
    iv: string;
}
export declare function encryptStrings(str1: string, str2: string): EncryptionResult;
export declare function decryptStrings(encryptedData: string, key: string, iv: string): [string, string];
export {};
