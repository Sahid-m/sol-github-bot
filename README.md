# GitHub Bounty Bot

## Check out the demo video to see the GitHub Bounty Bot in action:

[![Watch the demo video](https://img.youtube.com/vi/0siVmTWFBZM/0.jpg)](https://youtu.be/0siVmTWFBZM)

## Overview

The GitHub Bounty Bot is an automation tool designed to incentivize open-source contributions by distributing bounties in the form of Solana native tokens. This bot supports two types of bounties:

1. **Issue-Based Bounty**: Rewards contributors for resolving specific issues.
2. **Pull Request Bounty**: Directly attaches a bounty to a pull request, rewarding the contributor upon successful merge.

### How It Works

When a contributor, wins a bounty, the bot first generates a wallet and transfers the bounty amount to that wallet and then the bot generates a unique link containing part of the private key to a wallet holding the bounty funds. This link is securely encrypted using the GitHub ID (`sub`) of the intended bounty winner. Only the winner, authenticated through GitHub, can decrypt the link and access the bounty.

#### Bounty Claim Process

1. **Link Generation**: The bot generates a link for the bounty winner, which contains one shard of the private key.
2. **Encryption**: The link is encrypted with the bounty winner's GitHub ID (`sub`), ensuring that only the rightful winner can access it.
3. **Decryption & Wallet Creation**: Upon logging into the website with their GitHub account, the winner decrypts the link. The bot combines this shard with another stored in the database, creating a wallet where the winner can claim their bounty.
4. **Security**: The bounty wallet is highly secure. Even if someone gains access to the database, they cannot hijack the bounty wallet, as the decryption requires the winner's GitHub ID.

This approach ensures a secure and seamless process for distributing bounties to contributors.

## Setup Instructions

To get started with the GitHub Bounty Bot, follow these steps:

1. **Install Dependencies**:  
   Run the following command to install the necessary npm packages:
   ```bash
   npm install
   ```
2. **Configure Environment Variables**:
   Populate the .env file using the provided .env.example file. Make sure to fill in all required environment variables,such as your Solana wallet details, GitHub API keys, and database credentials.
3. **Migrate Database**:  
   Migrate Your Prisma database by running:
   ```bash
   npx prisma migrate dev
   ```
4. **Build the Project**:  
   Build the project with:
   ```bash
   npm run build
   ```
5. **Run the project**:  
   Run the following command to start the bot:
   ```bash
   npm run start
   ```
