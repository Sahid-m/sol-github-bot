import { Probot } from "probot";
import db from "./db/index.js";
import { getSolBalanaceInUSD } from "./lib/Solutils.js";
import {
  extractAmount,
  extractSolPublicKey,
  IsBountyComment,
  IsTryComment,
} from "./lib/utils.js";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    app.log.info(context);
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.closed", async (context) => {
    const prBody = context.payload.pull_request.body;
    const merged = context.payload.pull_request.merged;
    const issueUrl = context.payload.pull_request.issue_url

    if (prBody == null || !merged || !issueUrl) {
      return;
    }

    const Pr_user = context.payload.pull_request.user.id

    const BountyIssue = await db.bounties.findFirst({
      where: {
          issueNumber: 
      },
    }) 
  });

  app.on("pull_request", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for Opening This PR make Sure You have issue number in Body ex. `#3` and are already trying for bounty, If this is a bounty PR",
    });
    context.octokit.issues.createComment(issueComment);
  });

  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    const commentBody = context.payload.comment.body.trim().toLocaleLowerCase();
    console.log(commentBody);

    const commenter = context.payload.comment.user.login;
    const RepoOwner = context.payload.repository.owner.login;
    const user = await db.user.findFirst({
      where: {
        sub: context.payload.repository.owner.id.toString(),
      },
    });

    if (!user || user.bountyId) return;

    if (IsBountyComment(commentBody) && commenter != RepoOwner) {
      const issueComment = context.issue({
        body: `You Are Not Authorised to create a bounty!`,
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    }

    if (IsTryComment(commentBody) && commenter === RepoOwner) {
      const issueComment = context.issue({
        body: `You Can't Join Your Own Bounty!`,
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    }

    if (IsBountyComment(commentBody)) {
      const bountyAmount = extractAmount(commentBody)?.replace("$", "");

      if (!bountyAmount) {
        const issueComment = context.issue({
          body: `Please Give Bounty Amount. Ex. /bounty $10`,
        });
        await context.octokit.issues.createComment(issueComment);
        return;
      }

      const BountyExists = await db.bounties.findFirst({
        where: {
          issueId: context.payload.issue.id.toString(),
        },
      });

      const userWallet = await db.solWallet.findFirst({
        where: {
          userid: user.id,
        },
      });
      if (!userWallet) return;

      if (BountyExists) {
        const previousBountyAmount = parseFloat(BountyExists.bountyAmount);
        const newBountyAmount = parseFloat(bountyAmount);
        const currentWalletBalance = parseFloat(userWallet.CurrentBountyBal);

        // prettier-ignore
        const updatedWalletBalance =
          (currentWalletBalance - previousBountyAmount) + newBountyAmount;
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
          body: `You Don't have enough bounty in your wallet! Please Transfer some solana before giving bounty at https://live-link/wallet.`,
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
            CurrentBountyBal: (
              parseFloat(userWallet.CurrentBountyBal) + parseFloat(bountyAmount)
            ).toString(),
          },
        });

        await prisma.bounties.create({
          data: {
            githubRepo: context.payload.repository.id.toString(),
            issueId: context.payload.issue.id.toString(),
            bountyAmount: bountyAmount,
            ownerId: user.id,
            completed: false,
            issueNumber: context.payload.issue.number.toString(),
          },
        });
      });

      const issueComment = context.issue({
        body: `Bounty Created!`,
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    } else if (IsTryComment(commentBody)) {
      console.log(commentBody);

      const sol_publicKey = extractSolPublicKey(context.payload.comment.body);

      console.log(sol_publicKey);

      if (!sol_publicKey) {
        const issueComment = context.issue({
          body: `Please also send your solana address as well! ex. /try solana_public_key`,
        });
        await context.octokit.issues.createComment(issueComment);
        return;
      }

      const bounty = await db.bounties.findFirst({
        where: {
          issueId: context.payload.issue.id.toString(),
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
        // Check if contributor is already assigned to a bounty
        if (contributor.bountyId) {
          const issueComment = context.issue({
            body: `You are already trying an bounty! Please Finish it or untry by commenting /untry at issue!`,
          });
          await context.octokit.issues.createComment(issueComment);
          return;
        } else {
          await db.contributor.update({
            where: {
              sub: contributor.sub,
            },
            data: {
              bountyId: bounty.id,
              solPublicKey: sol_publicKey,
            },
          });

          const issueComment = context.issue({
            body: `Thanks For trying this bounty! Please Go ahead and file a pr with issue number when you're done to claim the bounty! `,
          });
          await context.octokit.issues.createComment(issueComment);
          return;
        }
      }

      await db.contributor.create({
        data: {
          solPublicKey: sol_publicKey,
          sub: context.payload.sender.id.toString(),
          email: context.payload.sender.email,
          bountyId: bounty.id,
        },
      });

      const issueComment = context.issue({
        body: `Thanks For trying this bounty! Please Go ahead and file a pr with issue number when you're done to claim the bounty! `,
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    }
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
