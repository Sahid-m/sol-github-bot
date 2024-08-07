import { Probot } from "probot";
import db from "./db/index.js";
import { getSolBalanaceInUSD } from "./lib/Solutils.js";
import { extractAmount, IsBountyComment, IsTryComment } from "./lib/utils.js";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    app.log.info(context);
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    const commentBody = context.payload.comment.body.trim().toLocaleLowerCase();

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
      const userWallet = await db.solWallet.findFirst({
        where: {
          userid: user.id,
        },
      });
      if (!userWallet) return;

      const userBalInUSD = await getSolBalanaceInUSD(userWallet.publicKey);

      if (userBalInUSD <= parseFloat(bountyAmount)) {
        const issueComment = context.issue({
          body: `You Don't have enough bounty in your wallet! Please Transfer some solana before giving bounty at https://live-link/wallet.`,
        });
        await context.octokit.issues.createComment(issueComment);
        return;
      }

      await db.solWallet.update({
        where: {
          id: userWallet.id,
        },
        data: {
          CurrentBountyBal: (
            parseFloat(userWallet.CurrentBountyBal) + parseFloat(bountyAmount)
          ).toString(),
        },
      });
    }

    // if (commenter === RepoOwner) {
    //   if (IsTryComment(commentBody)) {
    //     const issueComment = context.issue({
    //       body: `You can't join your bounty, bozzo!`,
    //     });
    //     await context.octokit.issues.createComment(issueComment);
    //     return;
    //   }
    //   if (!IsBountyComment(commentBody)) return;

    //   const amount = extractAmount(commentBody)?.replace("$", "");

    //   if (!amount) {
    //     const issueComment = context.issue({
    //       body: `Please send a valid bounty amount @${context.payload.sender.login}. Example command to send bounty: "/bounty $300", this will send $300 to contributor. `,
    //     });
    //     await context.octokit.issues.createComment(issueComment);
    //     return;
    //   }

    //   const issueComment = context.issue({
    //     body: `Your Bounty for ${amount} is Set on this Issue! `,
    //   });
    //   await context.octokit.issues.createComment(issueComment);
    //   return;
    // } else {
    //   if (!IsTryComment(commentBody)) return;

    //   const sol_publicKey = extractSolPublicKey(commentBody);

    //   if (!sol_publicKey) {
    //     const comment = context.issue({
    //       body: "Please also give your solana public address which will be used to send solana to",
    //     });
    //     await context.octokit.issues.createComment(comment);
    //     return;
    //   }

    //   const comment = context.issue({
    //     body: "You have joined the bounty! Please File a PR when you're done with the issue number",
    //   });
    //   await context.octokit.issues.createComment(comment);
    //   return;
    // }
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
