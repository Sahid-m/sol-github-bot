import { Keypair } from "@solana/web3.js";
import { split } from "shamir-secret-sharing";
import db from "./db/index.js";
import { getSolBalanaceInUSD, sendSolToPublicKey } from "./lib/Solutils.js";
import { encryptStrings, extractAmount, extractClaimNumber, IsAttemptComment, IsBountyComment, isRemoveComment, } from "./lib/utils.js";
export default (app) => {
    app.on("pull_request.closed", async (context) => {
        if (context.isBot) {
            return;
        }
        const prBody = context.payload.pull_request.body;
        const merged = context.payload.pull_request.merged;
        // check if PR is merged!
        if (prBody == null || !merged) {
            return;
        }
        // extracts issue Number
        const issueNo = extractClaimNumber(prBody);
        if (!issueNo) {
            return;
        }
        // gets user that filed PR
        const Pr_user = context.payload.pull_request.user.id;
        const BountyIssue = await db.bounties.findFirst({
            where: {
                issueNumber: issueNo,
            },
            include: {
                contributors: true,
                owner: true,
            },
        });
        // return if that issue has no bounty
        if (!BountyIssue)
            return;
        let contributorId;
        let contributorBountyWon;
        let contributorName;
        BountyIssue.contributors.map((contributor) => {
            if (contributor.sub === Pr_user.toString()) {
                contributorId = contributor.id;
                contributorBountyWon = contributor.totalBountyWon;
                contributorName = contributor.name;
            }
        });
        // check if the contributor has things
        if (!contributorId || !contributorBountyWon || !contributorName) {
            return;
        }
        // gets user wallet for sending sol
        const userWallet = await db.solWallet.findFirst({
            where: {
                userid: BountyIssue.ownerId,
            },
        });
        if (!userWallet)
            return;
        // FIX FROM HERE
        const tempWallet = Keypair.generate();
        //@ts-ignore
        const [share1, share2, share3] = await split(tempWallet.secretKey, 3, 2);
        const { encryptedData, key, iv } = encryptStrings(share1.toString(), context.payload.pull_request.user.id.toString());
        await sendSolToPublicKey(userWallet.privateKey, tempWallet.publicKey.toBase58(), parseFloat(BountyIssue.bountyAmount));
        const claimLink = `https://git-sol-bot.vercel.app/claim/bounty?token=${encryptedData}`;
        const bountyWinner = await db.bountyWinner.create({
            data: {
                bountyAmount: BountyIssue.bountyAmount,
                encryptionIv: iv,
                encryptionKey: key,
                name: context.payload.pull_request.user.login,
                prLink: context.payload.pull_request.html_url,
                prNumber: context.payload.pull_request.number.toString(),
                profileImg: context.payload.pull_request.user.avatar_url,
                walletPrivateKeyShard: share2.toString(),
                walletPublicKey: tempWallet.publicKey.toBase58(),
                tokenPrefix: encryptedData.slice(0, 20),
                winnerSub: context.payload.pull_request.user.id.toString(),
                status: "PAID",
                Bounty: {
                    connect: {
                        id: BountyIssue.id,
                    },
                },
                contributor: {
                    connect: {
                        id: contributorId,
                    },
                },
            },
        });
        if (!claimLink || !encryptedData) {
            const comment = context.issue({
                issue_number: parseInt(issueNo),
                body: `Some Error in doing transaction! @${context.payload.repository.owner.login}, @${contributorName} has not been transfered bounty of ${BountyIssue.bountyAmount}.`,
            });
            await context.octokit.issues.createComment(comment);
            return;
        }
        const comment = context.issue({
            issue_number: parseInt(issueNo),
            body: `Congratulations to @${context.payload.pull_request.user.login} For Winning Bounty of $${BountyIssue.bountyAmount}! \n Claim Your Bounty By Logging in with same github at [GitSol](${claimLink})  `,
        });
        await context.octokit.issues.createComment(comment);
        await db.bounties.update({
            where: {
                id: BountyIssue.id,
            },
            data: {
                completed: true,
                // winnerId: contributorId,
                Winner: {
                    connect: {
                        id: bountyWinner.id,
                    },
                },
                owner: {
                    update: {
                        solWallet: {
                            update: {
                                CurrentBountyBal: (parseFloat(userWallet.CurrentBountyBal) -
                                    parseFloat(BountyIssue.bountyAmount)).toString(),
                            },
                        },
                    },
                },
                contributors: {
                    update: {
                        where: {
                            id: contributorId,
                        },
                        data: {
                            totalBountyWon: (parseFloat(BountyIssue.bountyAmount) +
                                parseFloat(contributorBountyWon)).toString(),
                            bountyWinner: {
                                connect: {
                                    id: bountyWinner.id,
                                },
                            },
                        },
                    },
                },
            },
        });
    });
    app.on("pull_request", async (context) => {
        const prBody = context.payload.pull_request.body;
        if (context.payload.action === "closed") {
            return;
        }
        if (!prBody) {
            const issueComment = context.issue({
                body: "Thanks for Opening This PR make Sure You have issue number in Body ex. **#3** and are already trying for bounty, If this is a bounty PR",
            });
            context.octokit.issues.createComment(issueComment);
            return;
        }
        const issueNo = extractClaimNumber(prBody);
        if (!issueNo) {
            const issueComment = context.issue({
                body: "Thanks for Opening This PR make Sure You have issue number in Body ex. **#3** and are already trying for bounty, If this is a bounty PR",
            });
            context.octokit.issues.createComment(issueComment);
            return;
        }
        const issueComment = context.issue({
            body: `Thanks for Opening This PR For Issue no: #${issueNo}! If this PR gets merged the user will get the bounty alloted to this isse!`,
        });
        context.octokit.issues.createComment(issueComment);
        return;
    });
    app.on("issue_comment.created", async (context) => {
        if (context.isBot)
            return;
        const commentBody = context.payload.comment.body.trim().toLocaleLowerCase();
        const commenter = context.payload.comment.user.login;
        const RepoOwner = context.payload.repository.owner.login;
        const user = await db.user.findFirst({
            where: {
                sub: context.payload.repository.owner.id.toString(),
            },
            include: {
                solWallet: true,
            },
        });
        if (!user || user.bountyId)
            return;
        if (IsBountyComment(commentBody) && commenter != RepoOwner) {
            const issueComment = context.issue({
                body: `You Are Not Authorised to create a bounty!`,
            });
            await context.octokit.issues.createComment(issueComment);
            return;
        }
        // FOR Directly PR BOUNTIES
        if (context.payload.issue.pull_request) {
            // check for '/bounty ';
            if (IsBountyComment(commentBody)) {
                const bountyAmount = extractAmount(commentBody)?.replace("$", "");
                if (!bountyAmount || !user.solWallet)
                    return;
                const tempWallet = Keypair.generate();
                //@ts-ignore
                const [share1, share2, share3] = await split(tempWallet.secretKey, 3, 2);
                const { encryptedData, key, iv } = encryptStrings(share1.toString(), context.payload.issue.user.id.toString());
                await sendSolToPublicKey(user.solWallet.privateKey, tempWallet.publicKey.toBase58(), parseFloat(bountyAmount));
                const claimLink = `https://git-sol-bot.vercel.app/claim/bounty?token=${encryptedData}`;
                await db.bountyWinner.create({
                    data: {
                        bountyAmount: bountyAmount,
                        tokenPrefix: encryptedData.slice(0, 20),
                        encryptionIv: iv,
                        encryptionKey: key,
                        name: context.payload.issue.user.login,
                        prLink: context.payload.issue.html_url,
                        prNumber: context.payload.issue.number.toString(),
                        profileImg: context.payload.issue.user.avatar_url,
                        walletPrivateKeyShard: share2.toString(),
                        walletPublicKey: tempWallet.publicKey.toBase58(),
                        winnerSub: context.payload.issue.user.id.toString(),
                        status: "PAID",
                    },
                });
                const issueComment = context.issue({
                    body: `Congratulations to @${context.payload.issue.user.login} For Winning Bounty of $${bountyAmount}! \n Claim Your Bounty By Logging in with same github at [GitSol](${claimLink})  `,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
        }
        if (isRemoveComment(commentBody) && commenter != RepoOwner) {
            const issueComment = context.issue({
                body: `You Are Not Authorised to remove a bounty!`,
            });
            await context.octokit.issues.createComment(issueComment);
            return;
        }
        if (IsAttemptComment(commentBody) && commenter === RepoOwner) {
            const issueComment = context.issue({
                body: `You Can't Attempt Your Own Bounty!`,
            });
            await context.octokit.issues.createComment(issueComment);
            return;
        }
        if (IsBountyComment(commentBody)) {
            const bountyAmount = extractAmount(commentBody)?.replace("$", "");
            if (!bountyAmount) {
                const issueComment = context.issue({
                    body: `Please Give Bounty Amount. Ex. **/bounty $10**`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            const BountyExists = await db.bounties.findFirst({
                where: {
                    issueId: context.payload.issue.id.toString(),
                },
            });
            const userWallet = user.solWallet;
            if (!userWallet) {
                const issueComment = context.issue({
                    body: `Make Sure You've registered at [GitSol](https://git-sol-bot.vercel.app/)! You dont have any wallet there`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            if (BountyExists) {
                const previousBountyAmount = parseFloat(BountyExists.bountyAmount);
                const newBountyAmount = parseFloat(bountyAmount);
                const currentWalletBalance = parseFloat(userWallet.CurrentBountyBal);
                // prettier-ignore
                const updatedWalletBalance = (currentWalletBalance - previousBountyAmount) + newBountyAmount;
                // Execute the updates in a transaction
                await db.$transaction([
                    db.bounties.update({
                        data: {
                            bountyAmount: bountyAmount, // Store the updated bounty amount
                        },
                        where: {
                            id: BountyExists.id,
                        },
                    }),
                    db.solWallet.update({
                        data: {
                            CurrentBountyBal: updatedWalletBalance.toString(), // Update the wallet balance
                        },
                        where: {
                            id: userWallet.id,
                        },
                    }),
                ]);
                const issueComment = context.issue({
                    body: `Bounty Balance Updated!`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            const userBalInUSD = await getSolBalanaceInUSD(userWallet.publicKey);
            if (userBalInUSD <= parseFloat(bountyAmount)) {
                const issueComment = context.issue({
                    body: `You Don't have enough bounty in your wallet! Please Transfer some solana before giving bounty at [GitSol](https://git-sol-bot.vercel.app/userwallet).`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            await db.$transaction(async (prisma) => {
                await prisma.solWallet.update({
                    where: {
                        id: userWallet.id,
                    },
                    data: {
                        CurrentBountyBal: (parseFloat(userWallet.CurrentBountyBal) + parseFloat(bountyAmount)).toString(),
                    },
                });
                await prisma.bounties.create({
                    data: {
                        githubRepoId: context.payload.repository.id.toString(),
                        issueId: context.payload.issue.id.toString(),
                        bountyAmount: bountyAmount,
                        ownerId: user.id,
                        completed: false,
                        issueName: context.payload.issue.title,
                        issueNumber: context.payload.issue.number.toString(),
                        issueLink: context.payload.issue.html_url,
                        githubRepoName: context.payload.repository.name,
                        issueDescription: context.payload.issue.body || "",
                        issueProgrammingLang: context.payload.repository.language,
                    },
                });
            });
            const issueComment = context.issue({
                body: `Bounty Created! \n  ### Steps to solve:
1. **Start working**: Comment \`/attempt\` with your implementation plan
2. **Submit work**: Create a pull request including \`/claim #${context.payload.issue.number}\` in the PR body to claim the bounty
3. **Receive payment**: 100% of the bounty is received instantly to your solana wallet
4. **Thank you for contributing to [${context.payload.sender.login}/${context.payload.repository.name}](${context.payload.repository.html_url})!** \n `,
            });
            await context.octokit.issues.createComment(issueComment);
            const label = `bounty $${bountyAmount}`;
            await context.octokit.issues.addLabels(context.issue({
                labels: [label],
            }));
            return;
        }
        else if (IsAttemptComment(commentBody)) {
            const bounty = await db.bounties.findFirst({
                where: {
                    issueId: context.payload.issue.id.toString(),
                    githubRepoId: context.payload.repository.id.toString(),
                    completed: false,
                },
            });
            if (!bounty) {
                const issueComment = context.issue({
                    body: `There is no bounty set on this issue!`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            const contributor = await db.contributor.findFirst({
                where: {
                    sub: context.payload.sender.id.toString(),
                },
            });
            // Check if contributor exists
            if (contributor) {
                await db.contributor.update({
                    where: {
                        sub: contributor.sub,
                    },
                    data: {
                        bounties: {
                            connect: {
                                id: bounty.id,
                            },
                        },
                    },
                });
            }
            else {
                await db.contributor.create({
                    data: {
                        sub: context.payload.sender.id.toString(),
                        email: context.payload.sender.email,
                        name: context.payload.sender.login,
                        profileImg: context.payload.sender.avatar_url,
                        bounties: {
                            connect: {
                                id: bounty.id,
                            },
                        },
                    },
                });
            }
            const issueComment = context.issue({
                body: `Thanks For trying this bounty! \n  Please Go ahead and file a pr with issue number in your Pr body when you're done to claim the bounty! \n ex: **/claim #${context.payload.issue.number}**`,
            });
            await context.octokit.issues.createComment(issueComment);
            return;
        }
        else if (isRemoveComment(commentBody)) {
            const bounty = await db.bounties.findFirst({
                where: {
                    issueId: context.payload.issue.id.toString(),
                },
            });
            if (!bounty || !bounty.issueNumber || !bounty.issueDescription) {
                const issueComment = context.issue({
                    body: `There is no bounty found on this issue!`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            if (bounty.completed) {
                const issueComment = context.issue({
                    body: `This bounty is already completed!`,
                });
                await context.octokit.issues.createComment(issueComment);
                return;
            }
            await context.octokit.issues.removeLabel({
                issue_number: parseInt(bounty.issueNumber),
                name: `bounty $${bounty.bountyAmount}`,
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
            });
            await db.bounties.delete({
                where: {
                    id: bounty.id,
                },
            });
            const issueComment = context.issue({
                body: `Successfully Removed the Bounty!`,
            });
            await context.octokit.issues.createComment(issueComment);
            return;
        }
    });
};
//# sourceMappingURL=index.js.map