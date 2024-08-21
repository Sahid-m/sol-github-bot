import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, } from "@solana/web3.js";
export async function getSolBalanaceInUSD(publicKey) {
    try {
        let wallet = new PublicKey(publicKey);
        const userSol = (await connection.getBalance(wallet)) / LAMPORTS_PER_SOL;
        const responce = await fetch("https://price.jup.ag/v6/price?ids=SOL", {
            method: "GET",
        });
        const data = await responce.json();
        const currentPrice = data.data.SOL.price;
        const userBal = userSol * currentPrice;
        return userBal;
    }
    catch (e) {
        console.error(e);
        console.log(e);
        return 0;
    }
}
export async function sendSolToPublicKey(UserPrivateKey, contributorPublicKey, amount) {
    const responce = await fetch("https://price.jup.ag/v6/price?ids=SOL", {
        method: "GET",
    });
    const data = await responce.json();
    const currentPrice = data.data.SOL.price;
    console.log("In send func before thing");
    const amountInSOL = amount / currentPrice;
    const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(UserPrivateKey.split(",").map(Number)));
    console.log("KeyPair Generated");
    const transaction = new Transaction();
    const instruction = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        lamports: Math.round(amountInSOL * LAMPORTS_PER_SOL),
        toPubkey: new PublicKey(contributorPublicKey),
    });
    console.log("before sending");
    transaction.add(instruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [
        fromKeypair,
    ]);
    console.log("after sending");
    return signature;
}
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
//# sourceMappingURL=Solutils.js.map